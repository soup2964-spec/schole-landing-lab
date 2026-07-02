import type { PageVariant } from "@/lib/schema/page";
import type { Visit } from "@/lib/schema/events";
import type { ExperimentRun, GenerationRun, AllocationSnapshot } from "@/lib/schema/experiment";
import type { Persona } from "@/lib/schema/persona";
import { getCalibratedPersonaSet } from "@/lib/calibration/store";
import { readPage, type PersonaReading } from "@/lib/sim/reading";
import { heuristicReadPage } from "@/lib/sim/heuristic-reading";
import { sampleVisit } from "@/lib/sim/visit";
import { ThompsonBandit } from "@/lib/sim/bandit";
import { computeMetrics } from "@/lib/sim/metrics";
import { makeRng, pickWeighted } from "@/lib/sim/rng";
import { analyzeGeneration } from "@/lib/stats/bayes";
import { mapPool } from "@/lib/async/pool";
import { evaluateGeneration } from "./evaluator";
import { breedVariant, pageSimilarity } from "./optimizer";
import type { ExperimentProgressReporter } from "@/lib/loop/experiment-progress";

interface ReadingTask {
  variant: PageVariant;
  persona: Persona;
  readIndex: number;
}

function readConcurrency(): number {
  return Number(process.env.LLM_READ_CONCURRENCY ?? 6);
}

function breedConcurrency(): number {
  return Number(process.env.LLM_BREED_CONCURRENCY ?? 3);
}

export type PersonaReadingMode = "llm" | "heuristic";

export interface RunConfig {
  seed: number;
  visitsPerGeneration: number;
  readingsPerPair: number; // LLM readings per (persona, variant) pair
  generations: number;
  offspringPerGeneration: number;
  /** llm = LLM reads each page as each persona; heuristic = rule-based readings, still uses LLM eval/breed. */
  personaReadingMode?: PersonaReadingMode;
  log?: (msg: string) => void;
  progress?: ExperimentProgressReporter;
}

export const DEFAULT_CONFIG: RunConfig = {
  seed: 20260701,
  visitsPerGeneration: 4800,
  readingsPerPair: 2,
  generations: 2,
  offspringPerGeneration: 6,
};

/** Config for UI-triggered LLM experiments (overridable via env). */
export function llmExperimentConfig(seed: number, log?: RunConfig["log"]): RunConfig {
  return {
    seed,
    visitsPerGeneration: Number(process.env.LLM_VISITS_PER_GEN ?? DEFAULT_CONFIG.visitsPerGeneration),
    readingsPerPair: Number(process.env.LLM_READINGS_PER_PAIR ?? DEFAULT_CONFIG.readingsPerPair),
    generations: Number(process.env.LLM_GENERATIONS ?? DEFAULT_CONFIG.generations),
    offspringPerGeneration: Number(
      process.env.LLM_OFFSPRING_PER_GEN ?? DEFAULT_CONFIG.offspringPerGeneration
    ),
    log,
  };
}

/**
 * Full experiment: persona readings → Monte Carlo visits → LLM evaluate → LLM breed.
 * Set personaReadingMode=heuristic to skip LLM readings (fast) while keeping eval/breed.
 */
export async function runExperiment(cfg: RunConfig = DEFAULT_CONFIG): Promise<ExperimentRun> {
  const log = cfg.log ?? (() => {});
  const progress = cfg.progress;
  const readingMode = cfg.personaReadingMode ?? "llm";
  const readingsPerPair = readingMode === "heuristic" ? 1 : cfg.readingsPerPair;
  const rng = makeRng(cfg.seed);
  const personaSet = getCalibratedPersonaSet();
  const personas = personaSet.personas;

  const { GENERATION_0 } = await import("@/config/variants");
  const allVariants: PageVariant[] = [...GENERATION_0];
  let pool: PageVariant[] = [...GENERATION_0];
  const generations: GenerationRun[] = [];

  for (let gen = 0; gen < cfg.generations; gen++) {
    log(`=== Generation ${gen}: ${pool.length} variants in pool ===`);
    progress?.setGeneration(gen, pool.length);

    // 1. Persona readings for every (persona, variant) pair.
    const readings = new Map<string, PersonaReading[]>();

    if (readingMode === "heuristic") {
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
    } else {
      const readingTasks: ReadingTask[] = [];
      for (const variant of pool) {
        for (const persona of personas) {
          for (let i = 0; i < readingsPerPair; i++) {
            readingTasks.push({ variant, persona, readIndex: i });
          }
        }
      }

      const parallel = readConcurrency();
      log(
        `  ${readingTasks.length} LLM persona readings (${parallel} parallel, ${readingsPerPair} per pair)...`
      );
      progress?.readingsStart(readingTasks.length);

      let readingsDone = 0;
      const completed = await mapPool(readingTasks, parallel, async (task) => {
        const reading = await readPage(
          task.persona,
          task.variant,
          cfg.seed + gen * 1000 + task.readIndex
        );
        readingsDone++;
        progress?.readingsProgress(readingsDone, readingTasks.length);
        if (readingsDone % parallel === 0 || readingsDone === readingTasks.length) {
          log(`  readings ${readingsDone}/${readingTasks.length}`);
        }
        return { ...task, reading };
      });

      progress?.readingsDone();

      for (const { variant, persona, readIndex, reading } of completed) {
        const key = `${variant.id}|${persona.id}`;
        if (!readings.has(key)) readings.set(key, []);
        readings.get(key)![readIndex] = reading;
      }
    }

    // 2. Monte Carlo visits with bandit allocation.
    progress?.simulating();
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
    const independentReadings =
      readingMode === "heuristic"
        ? personas.length
        : personas.length * readingsPerPair;
    const decisions = analyzeGeneration(
      metrics.map((m) => ({
        id: m.variantId,
        conversions: m.conversions,
        visits: m.visits,
        bounceRate: m.bounceRate,
        independentReadings,
      })),
      baselineId,
      cfg.seed + gen * 7919
    );
    log(`  evaluating generation ${gen}...`);
    progress?.evaluating();
    const report = await evaluateGeneration(gen, pool, metrics, visits);

    // 4. Breed offspring (skip after the final generation).
    const offspring: PageVariant[] = [];
    if (gen < cfg.generations - 1) {
      const ranked = metrics
        .map((m) => pool.find((v) => v.id === m.variantId)!)
        .filter(Boolean);
      const top = ranked.slice(0, Math.min(3, ranked.length));

      const breedParallel = breedConcurrency();
      log(`  breeding ${cfg.offspringPerGeneration} offspring (${breedParallel} parallel)...`);
      progress?.breedingStart(cfg.offspringPerGeneration);

      let bredDone = 0;
      const bred = await mapPool(
        Array.from({ length: cfg.offspringPerGeneration }, (_, c) => c),
        breedParallel,
        async (c) => {
          const mode = c % 2 === 0 ? "mutation" : "crossover";
          const parents =
            mode === "mutation" ? [top[c % top.length] ?? top[0]] : top;
          log(`  breeding ${mode} child ${c}...`);
          let child = await breedVariant(mode, parents, metrics, report, gen, c);

          const tooSimilar = [...allVariants, ...offspring].some(
            (v) => pageSimilarity(child, v) > 0.72
          );
          if (tooSimilar) {
            log(`    child ${c} too similar; retrying with crossover...`);
            child = await breedVariant("crossover", top, metrics, report, gen, c);
          }
          bredDone++;
          progress?.breedingProgress(bredDone, cfg.offspringPerGeneration);
          return child;
        }
      );
      offspring.push(...bred);
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
