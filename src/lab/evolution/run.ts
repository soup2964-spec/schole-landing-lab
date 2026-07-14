import type { PageVariant } from "@/shared/schema/page";
import type { Visit } from "@/shared/schema/events";
import type { ExperimentRun, GenerationRun, AllocationSnapshot } from "@/shared/schema/experiment";
import { getCalibratedPersonaSet } from "@/lab/calibration/store";
import type { PersonaReading } from "@/lab/simulation/reading";
import { heuristicReadPage } from "@/lab/simulation/heuristic-reading";
import { sampleVisit } from "@/lab/simulation/visit";
import { ThompsonBandit } from "@/lab/simulation/bandit";
import { computeMetrics } from "@/lab/simulation/metrics";
import { makeRng, pickWeighted } from "@/lab/simulation/rng";
import { analyzeGeneration } from "@/shared/stats/bayes";
import { buildComputedReport } from "./computed-report";
import type { ExperimentProgressReporter } from "@/lab/live-loop/experiment-progress";
import { loadSourceBaselineHtml } from "@/lab/deploy/write-html";
import type { VariantMetrics } from "@/shared/schema/events";
import { breedAllOffspring } from "./run-pipeline";

export interface RunConfig {
  seed: number;
  visitsPerGeneration: number;
  generations: number;
  offspringPerGeneration: number;
  /** When set (experiment 2+), starts from prior bred pages instead of gen-0. */
  initialPool?: PageVariant[];
  log?: (msg: string) => void;
  progress?: ExperimentProgressReporter;
}

export const DEFAULT_CONFIG: RunConfig = {
  seed: 20260701,
  visitsPerGeneration: 4800,
  generations: 2,
  offspringPerGeneration: 6,
};

/** Config for UI-triggered experiments (overridable via env). */
export function llmExperimentConfig(seed: number, log?: RunConfig["log"]): RunConfig {
  return {
    seed,
    visitsPerGeneration: Number(process.env.LLM_VISITS_PER_GEN ?? DEFAULT_CONFIG.visitsPerGeneration),
    generations: Number(process.env.LLM_GENERATIONS ?? DEFAULT_CONFIG.generations),
    offspringPerGeneration: Number(
      process.env.LLM_OFFSPRING_PER_GEN ?? DEFAULT_CONFIG.offspringPerGeneration
    ),
    log,
  };
}

/**
 * Experiment: heuristic persona readings → Monte Carlo visits → behavior report → LLM breed.
 */
export async function runExperiment(cfg: RunConfig = DEFAULT_CONFIG): Promise<ExperimentRun> {
  const log = cfg.log ?? (() => {});
  const progress = cfg.progress;
  const rng = makeRng(cfg.seed);
  const personaSet = await getCalibratedPersonaSet();
  const personas = personaSet.personas;
  const baselineHtml = loadSourceBaselineHtml();
  const { GENERATION_0: gen0 } = await import("@/config/variants");
  const baselineVariant = gen0[0];
  const startingPool =
    cfg.initialPool?.length && cfg.initialPool.length > 0
      ? cfg.initialPool.map((v) => structuredClone(v))
      : [...gen0];
  const allVariants: PageVariant[] = [...startingPool];
  let pool: PageVariant[] = [...startingPool];
  const generations: GenerationRun[] = [];

  for (let gen = 0; gen < cfg.generations; gen++) {
    log(`=== Generation ${gen}: ${pool.length} variants in pool ===`);
    progress?.setGeneration(gen, pool.length);

    let visits: Visit[] = [];
    let metrics: VariantMetrics[] = [];
    let decisions: ReturnType<typeof analyzeGeneration> = [];
    let allocationHistory: AllocationSnapshot[] = [];
    let totalVisits = 0;

    // 1. Heuristic persona readings for every (persona, variant) pair.
    const readings = new Map<string, PersonaReading[]>();
    const total = pool.length * personas.length;
    log(`  ${total} heuristic persona readings...`);
    progress?.readingsStart(total);
    let done = 0;
    for (const variant of pool) {
      for (const persona of personas) {
        const key = `${variant.id}|${persona.id}`;
        readings.set(key, [
          heuristicReadPage(persona, variant, cfg.seed + gen * 100 + persona.id.length),
        ]);
        done++;
        if (done % 6 === 0 || done === total) progress?.readingsProgress(done, total);
      }
    }
    progress?.readingsDone();

    // 2. Monte Carlo visits with bandit allocation.
    progress?.simulating();
    const bandit = new ThompsonBandit(pool.map((v) => v.id));
    visits = [];
    allocationHistory = [];
    const snapshotEvery = Math.max(1, Math.floor(cfg.visitsPerGeneration / 20));

    for (let i = 0; i < cfg.visitsPerGeneration; i++) {
      const variantId = bandit.pick(rng);
      const variant = pool.find((v) => v.id === variantId)!;
      const persona = pickWeighted(rng, personas, (p) => p.trafficWeight);
      const rs = readings.get(`${variant.id}|${persona.id}`)!;
      const reading = rs[Math.floor(rng() * rs.length)];
      const visit = sampleVisit(rng, persona, variant, reading, gen, i);
      visits.push(visit);
      bandit.record(variantId, visit.converted);
      if ((i + 1) % snapshotEvery === 0) {
        allocationHistory.push({ afterVisits: i + 1, shares: bandit.shares() });
      }
    }

    // 3. Metrics + Bayesian decisions + evaluator report.
    metrics = pool.map((v) => computeMetrics(v, visits));
    metrics.sort((a, b) => b.fitness - a.fitness);
    const baselineId = pool.some((v) => v.id === "v0-baseline")
      ? "v0-baseline"
      : metrics[metrics.length - 1].variantId;
    decisions = analyzeGeneration(
      metrics.map((m) => ({
        id: m.variantId,
        conversions: m.conversions,
        visits: m.visits,
        bounceRate: m.bounceRate,
        independentReadings: personas.length,
      })),
      baselineId,
      cfg.seed + gen * 7919
    );
    log(`  building behavior report for generation ${gen}...`);
    progress?.evaluating();
    const report = buildComputedReport(gen, pool, metrics, decisions);
    totalVisits = visits.length;

    // 4. Breed offspring (skip after the final generation).
    const offspring: PageVariant[] = [];
    const shouldBreed = gen < cfg.generations - 1;
    if (shouldBreed) {
      const ranked = metrics
        .map((m) => pool.find((v) => v.id === m.variantId)!)
        .filter(Boolean);
      const top = ranked.slice(0, Math.min(3, ranked.length));

      const bred = await breedAllOffspring(
        cfg.offspringPerGeneration,
        top,
        metrics,
        report,
        gen,
        visits,
        baselineHtml,
        baselineVariant,
        log,
        progress
      );
      offspring.push(...bred);
      allVariants.push(...offspring);
    }

    generations.push({
      generation: gen,
      variantIds: pool.map((v) => v.id),
      visits,
      totalVisits: totalVisits || visits.length,
      metrics,
      allocationHistory,
      report,
      decisions,
      offspringIds: offspring.map((o) => o.id),
    });

    // Next generation pool: statistical kill gate, then survivors + offspring.
    const killed = new Set(
      decisions.filter((d) => d.status === "killed").map((d) => d.variantId)
    );
    const rankedIds = metrics.map((m) => m.variantId).filter((id) => !killed.has(id));
    const survivors = rankedIds
      .slice(0, Math.max(2, pool.length - cfg.offspringPerGeneration - killed.size))
      .map((id) => pool.find((v) => v.id === id)!);
    pool = [...survivors, ...offspring];
  }

  return {
    id: `run-${cfg.seed}`,
    createdAt: new Date().toISOString(),
    personaSetVersion: personaSet.version,
    variants: allVariants,
    generations,
  };
}
