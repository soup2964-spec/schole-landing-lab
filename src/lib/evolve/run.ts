import type { PageVariant } from "@/lib/schema/page";
import type { Visit } from "@/lib/schema/events";
import type { ExperimentRun, GenerationRun, AllocationSnapshot } from "@/lib/schema/experiment";
import { getCalibratedPersonaSet } from "@/lib/calibration/store";
import { readPage, type PersonaReading } from "@/lib/sim/reading";
import { sampleVisit } from "@/lib/sim/visit";
import { ThompsonBandit } from "@/lib/sim/bandit";
import { computeMetrics } from "@/lib/sim/metrics";
import { makeRng, pickWeighted } from "@/lib/sim/rng";
import { analyzeGeneration } from "@/lib/stats/bayes";
import { evaluateGeneration } from "./evaluator";
import { breedVariant, pageSimilarity } from "./optimizer";

export interface RunConfig {
  seed: number;
  visitsPerGeneration: number;
  readingsPerPair: number; // LLM readings per (persona, variant) pair
  generations: number;
  offspringPerGeneration: number;
  log?: (msg: string) => void;
}

export const DEFAULT_CONFIG: RunConfig = {
  seed: 20260701,
  visitsPerGeneration: 600,
  readingsPerPair: 3,
  generations: 3,
  offspringPerGeneration: 2,
};

/**
 * Full experiment: for each generation, LLM-read every (persona, variant)
 * pair a few times, then Monte-Carlo sample visits with Thompson-sampling
 * traffic allocation, evaluate, and breed offspring for the next generation.
 */
export async function runExperiment(cfg: RunConfig = DEFAULT_CONFIG): Promise<ExperimentRun> {
  const log = cfg.log ?? (() => {});
  const rng = makeRng(cfg.seed);
  const personaSet = getCalibratedPersonaSet();
  const personas = personaSet.personas;

  const { GENERATION_0 } = await import("@/config/variants");
  const allVariants: PageVariant[] = [...GENERATION_0];
  let pool: PageVariant[] = [...GENERATION_0];
  const generations: GenerationRun[] = [];

  for (let gen = 0; gen < cfg.generations; gen++) {
    log(`=== Generation ${gen}: ${pool.length} variants in pool ===`);

    // 1. LLM readings for every (persona, variant) pair.
    const readings = new Map<string, PersonaReading[]>();
    for (const variant of pool) {
      for (const persona of personas) {
        const key = `${variant.id}|${persona.id}`;
        const rs: PersonaReading[] = [];
        for (let i = 0; i < cfg.readingsPerPair; i++) {
          log(`  reading ${persona.id} x ${variant.id} (${i + 1}/${cfg.readingsPerPair})`);
          rs.push(await readPage(persona, variant, cfg.seed + gen * 1000 + i));
        }
        readings.set(key, rs);
      }
    }

    // 2. Monte Carlo visits with bandit allocation.
    const bandit = new ThompsonBandit(pool.map((v) => v.id));
    const visits: Visit[] = [];
    const allocationHistory: AllocationSnapshot[] = [];
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
    const metrics = pool.map((v) => computeMetrics(v, visits));
    metrics.sort((a, b) => b.fitness - a.fitness);
    const baselineId = pool.some((v) => v.id === "v0-baseline")
      ? "v0-baseline"
      : metrics[metrics.length - 1].variantId;
    const decisions = analyzeGeneration(
      metrics.map((m) => ({
        id: m.variantId,
        conversions: m.conversions,
        visits: m.visits,
        bounceRate: m.bounceRate,
      })),
      baselineId,
      cfg.seed + gen * 7919
    );
    log(`  evaluating generation ${gen}...`);
    const report = await evaluateGeneration(gen, pool, metrics, visits);

    // 4. Breed offspring (skip after the final generation).
    const offspring: PageVariant[] = [];
    if (gen < cfg.generations - 1) {
      const ranked = metrics
        .map((m) => pool.find((v) => v.id === m.variantId)!)
        .filter(Boolean);
      const top = ranked.slice(0, Math.min(3, ranked.length));

      for (let c = 0; c < cfg.offspringPerGeneration; c++) {
        const mode = c === 0 ? "mutation" : "crossover";
        const parents = mode === "mutation" ? [top[0]] : top;
        log(`  breeding ${mode} child ${c}...`);
        let child = await breedVariant(mode, parents, metrics, report, gen, c);

        // Diversity guard: if too similar to an existing page, retry once.
        const tooSimilar = [...allVariants, ...offspring].some(
          (v) => pageSimilarity(child, v) > 0.72
        );
        if (tooSimilar) {
          log(`    child too similar to an existing variant; retrying with crossover...`);
          child = await breedVariant("crossover", top, metrics, report, gen, c);
        }
        offspring.push(child);
      }
      allVariants.push(...offspring);
    }

    generations.push({
      generation: gen,
      variantIds: pool.map((v) => v.id),
      visits,
      totalVisits: visits.length,
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
