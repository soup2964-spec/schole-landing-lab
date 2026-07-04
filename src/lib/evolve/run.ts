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
import { buildComputedReport } from "./computed-report";
import { breedVariant, pageSimilarity, angleForChild, BREEDING_ANGLES } from "./optimizer";
import type { BreedingAngle } from "./optimizer";
import type { ExperimentProgressReporter } from "@/lib/loop/experiment-progress";
import { loadSourceBaselineHtml, writeVariantHtml } from "@/lib/deploy/write-html";
import type { GenerationReport } from "@/lib/schema/experiment";
import type { VariantMetrics } from "@/lib/schema/events";

function heroHeadline(variant: PageVariant): string {
  return variant.sections.find((s) => s.type === "hero" || s.id === "hero")?.headline ?? "";
}

function crossoverParents(top: PageVariant[], index: number): PageVariant[] {
  if (top.length < 2) return top;
  const pairs: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 2],
    [2, 1],
    [1, 0],
    [2, 0],
  ];
  const [a, b] = pairs[index % pairs.length];
  return [top[a] ?? top[0], top[b] ?? top[1]].filter(
    (p, i, arr) => p && arr.indexOf(p) === i
  );
}

function textWordSet(text: string): Set<string> {
  return new Set(
    (text ?? "")
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const inter = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
}

/**
 * A candidate is a duplicate of a sibling if it shares a hero headline, is too
 * similar on section copy, or makes the same strategic bet (thesis overlap).
 * Compared against SIBLINGS only — offspring are intentionally anchored to base
 * angles, so resembling a base parent is expected, not a collision.
 */
function isDuplicateOffspring(candidate: PageVariant, siblings: PageVariant[]): boolean {
  const hero = heroHeadline(candidate);
  const candThesis = textWordSet(candidate.thesis ?? "");
  return siblings.some((v) => {
    if (hero && heroHeadline(v) === hero) return true;
    if (pageSimilarity(candidate, v) > 0.5) return true;
    if (jaccard(candThesis, textWordSet(v.thesis ?? "")) > 0.6) return true;
    return false;
  });
}

/** Sample a few verbatim converted/lost verdicts per parent to ground the copy. */
function sampleVerdictBlock(visits: Visit[], parents: PageVariant[]): string {
  const lines: string[] = [];
  for (const p of parents) {
    const vs = visits.filter((x) => x.variantId === p.id);
    const converted = vs.filter((x) => x.converted).slice(0, 2);
    const lost = vs.filter((x) => !x.converted).slice(0, 3);
    for (const x of [...converted, ...lost]) {
      lines.push(
        `  [${p.id} · ${x.personaId} · ${x.converted ? "CONVERTED" : "LOST"}] "${x.verdict}"`
      );
    }
  }
  return lines.join("\n");
}

async function breedDistinctOffspring(
  childIndex: number,
  top: PageVariant[],
  metrics: VariantMetrics[],
  report: GenerationReport,
  generation: number,
  siblings: PageVariant[],
  angle: BreedingAngle,
  verdictBlock: string,
  log: (msg: string) => void
): Promise<PageVariant> {
  const attempts: { mode: "mutation" | "crossover"; parents: PageVariant[] }[] = [
    {
      mode: childIndex % 2 === 0 ? "mutation" : "crossover",
      parents:
        childIndex % 2 === 0
          ? [top[childIndex % top.length] ?? top[0]]
          : crossoverParents(top, childIndex),
    },
    { mode: "mutation", parents: [top[(childIndex + 1) % top.length] ?? top[0]] },
    { mode: "crossover", parents: crossoverParents(top, childIndex + 2) },
    { mode: "mutation", parents: [top[(childIndex + 2) % top.length] ?? top[0]] },
  ];

  let last: PageVariant | null = null;
  for (let attempt = 0; attempt < attempts.length; attempt++) {
    const { mode, parents } = attempts[attempt];
    log(`  breeding ${angle.name} (child ${childIndex}, ${mode})${attempt ? ` retry ${attempt}` : ""}...`);
    const child = await breedVariant(
      mode,
      parents,
      metrics,
      report,
      generation,
      childIndex,
      angle,
      verdictBlock
    );
    last = child;
    if (!isDuplicateOffspring(child, siblings)) return child;
    log(`    ${angle.name} too similar to a sibling; retrying...`);
  }
  return last!;
}

interface ReadingTask {
  variant: PageVariant;
  persona: Persona;
  readIndex: number;
}

function readConcurrency(): number {
  return Number(process.env.LLM_READ_CONCURRENCY ?? 6);
}

function breedConcurrency(): number {
  return Number(process.env.LLM_BREED_CONCURRENCY ?? 6);
}

/**
 * Breed all offspring with bounded parallel KIE calls. Each child is pinned to a
 * distinct base-preview angle so the batch explores different bets; duplicates
 * (same hero/thesis as an already-accepted sibling) are retried sequentially.
 */
async function breedAllOffspring(
  count: number,
  top: PageVariant[],
  metrics: VariantMetrics[],
  report: GenerationReport,
  generation: number,
  visits: Visit[],
  baselineHtml: string,
  baselineVariant: PageVariant,
  log: (msg: string) => void,
  progress?: ExperimentProgressReporter
): Promise<PageVariant[]> {
  const parallel = Math.max(1, Math.min(breedConcurrency(), count));
  const verdictBlock = sampleVerdictBlock(visits, top);
  const angleCount = Math.min(count, BREEDING_ANGLES.length);

  log(`  breeding ${count} offspring across ${angleCount} angles (${parallel} parallel KIE calls)...`);
  progress?.breedingStart(count);

  const offspring: PageVariant[] = [];
  // Serialize accept + persist so previews land as each KIE call returns.
  let acceptChain = Promise.resolve();

  await mapPool(
    Array.from({ length: count }, (_, i) => i),
    parallel,
    async (childIndex) => {
      const angle = angleForChild(childIndex);
      const child = await breedDistinctOffspring(
        childIndex,
        top,
        metrics,
        report,
        generation,
        [],
        angle,
        verdictBlock,
        log
      );
      log(`  ${angle.name} LLM returned (child ${childIndex})`);

      await new Promise<void>((resolve, reject) => {
        acceptChain = acceptChain.then(async () => {
          try {
            let accepted = child;
            if (isDuplicateOffspring(accepted, offspring)) {
              log(`  ${angle.name} duplicate; retrying against siblings...`);
              accepted = await breedDistinctOffspring(
                childIndex,
                top,
                metrics,
                report,
                generation,
                offspring,
                angle,
                verdictBlock,
                log
              );
            }
            offspring.push(accepted);
            progress?.breedingProgress(offspring.length, count);
            progress?.addBredVariant(accepted);
            writeVariantHtml(accepted, baselineHtml, baselineVariant);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    }
  );

  await acceptChain;
  return offspring;
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
  const personaSet = await getCalibratedPersonaSet();
  const personas = personaSet.personas;
  const baselineHtml = loadSourceBaselineHtml();
  const baselineVariant = (await import("@/config/variants")).GENERATION_0[0];
  const allVariants: PageVariant[] = [...(await import("@/config/variants")).GENERATION_0];
  let pool: PageVariant[] = [...(await import("@/config/variants")).GENERATION_0];
  const generations: GenerationRun[] = [];

  for (let gen = 0; gen < cfg.generations; gen++) {
    log(`=== Generation ${gen}: ${pool.length} variants in pool ===`);
    progress?.setGeneration(gen, pool.length);

    let visits: Visit[] = [];
    let metrics: VariantMetrics[] = [];
    let decisions: ReturnType<typeof analyzeGeneration> = [];
    let report: GenerationReport;
    let allocationHistory: AllocationSnapshot[] = [];
    let totalVisits = 0;

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
      const independentReadings =
        readingMode === "heuristic"
          ? personas.length
          : personas.length * readingsPerPair;
      decisions = analyzeGeneration(
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
      log(`  building behavior report for generation ${gen}...`);
      progress?.evaluating();
      report = buildComputedReport(gen, pool, metrics, decisions);
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
