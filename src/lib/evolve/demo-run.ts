/**
 * Heuristic demo experiment — shared by CLI script and the live sync loop.
 */
import type { PageVariant } from "@/lib/schema/page";
import type { Visit } from "@/lib/schema/events";
import type { ExperimentRun, GenerationRun, AllocationSnapshot } from "@/lib/schema/experiment";
import { GENERATION_0 } from "@/config/variants";
import { getCalibratedPersonaSet } from "@/lib/calibration/store";
import { heuristicReadPage } from "@/lib/sim/heuristic-reading";
import { sampleVisit } from "@/lib/sim/visit";
import { ThompsonBandit } from "@/lib/sim/bandit";
import { computeMetrics } from "@/lib/sim/metrics";
import { makeRng, pickWeighted, type Rng } from "@/lib/sim/rng";
import { analyzeGeneration, type VariantDecision } from "@/lib/stats/bayes";

export interface DemoRunConfig {
  seed?: number;
  visitsPerGeneration?: number;
  generations?: number;
  /** Max full visit traces stored per generation (metrics use all visits). */
  storedVisitsPerGeneration?: number;
}

const DEFAULTS = {
  seed: 20260701,
  // Sized for statistical power: detecting a +50% relative lift on a 3%
  // baseline needs ~2,000 visits/arm; 4,800/gen across ~6 arms approaches it
  // while keeping run time and stored-sample size reasonable.
  visitsPerGeneration: 4800,
  generations: 2,
  storedVisitsPerGeneration: 480,
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function breedHeuristic(
  parents: PageVariant[],
  metrics: ReturnType<typeof computeMetrics>[],
  generation: number,
  index: number
): PageVariant {
  const ranked = metrics
    .slice()
    .sort((a, b) => b.fitness - a.fitness)
    .map((m) => parents.find((p) => p.id === m.variantId)!)
    .filter(Boolean);

  const winner = ranked[0];
  const runnerUp = ranked[1] ?? winner;
  const pick = (v: PageVariant, id: string) => v.sections.find((s) => s.id === id) ?? v.sections[0];
  const winnerOutcomes =
    winner.sections.find((s) => s.type === "outcomes") ??
    runnerUp.sections.find((s) => s.type === "outcomes");
  const winnerIntegration = winner.sections.find((s) => s.type === "integration");
  const runnerProof = runnerUp.sections.find((s) => s.type === "social_proof");

  const sections: PageVariant["sections"] = [
    pick(winner, "hero"),
    winner.sections.find((s) => s.type === "problem") ?? pick(winner, winner.sections[1]?.id),
    ...(winnerOutcomes ? [winnerOutcomes] : []),
    winner.sections.find((s) => s.type === "how_it_works" || s.type === "features") ??
      winner.sections[2],
    ...(runnerProof ? [runnerProof] : []),
    ...(winnerIntegration ? [winnerIntegration] : []),
    winner.sections.find((s) => s.type === "cta") ?? winner.sections[winner.sections.length - 1],
  ].filter(Boolean) as PageVariant["sections"];

  const id = `g${generation + 1}-demo${index}`;
  const topMetric = metrics.find((m) => m.variantId === winner.id)!;
  const topFailure = Object.entries(topMetric.objectionFailures).sort((a, b) => b[1] - a[1])[0];

  return {
    id,
    name: index === 0 ? "Evidence-bred hybrid" : "Objection-targeted remix",
    strategy: "generated",
    generation: generation + 1,
    parentIds: [winner.id, runnerUp.id],
    ctaGoal: winner.ctaGoal,
    thesis: `Crossover of ${winner.name} (fitness ${topMetric.fitness.toFixed(1)}) and ${runnerUp.name}.`,
    changelog: [
      {
        what: "Kept the winning hero and problem framing",
        why: "Highest read rates and lowest exit rates in the parent.",
        evidence: `${winner.id} led generation ${generation} with fitness ${topMetric.fitness.toFixed(1)}.`,
        sourceVariantId: winner.id,
      },
      {
        what: topFailure
          ? `Strengthened content addressing ${topFailure[0]}`
          : "Strengthened outcomes and integration sections",
        why: "Unresolved critical objections were the top conversion killer.",
        evidence: topFailure
          ? `${topFailure[0]} unresolved in ${topFailure[1]} lost visits.`
          : "Objection failures dominated exit reasons.",
      },
    ],
    sections: sections.map((s, i) => ({ ...s, id: `${s.id}-g${generation + 1}-${i}` })),
  };
}

function runGeneration(
  gen: number,
  pool: PageVariant[],
  rng: Rng,
  seed: number,
  visitsPerGen: number,
  maxGenerations: number,
  storedVisits: number
): { genRun: GenerationRun; offspring: PageVariant[]; decisions: VariantDecision[] } {
  const personaSet = getCalibratedPersonaSet();
  const personas = personaSet.personas;
  const readings = new Map<string, ReturnType<typeof heuristicReadPage>>();
  for (const v of pool) {
    for (const p of personas) {
      readings.set(`${v.id}|${p.id}`, heuristicReadPage(p, v, seed + gen * 100 + p.id.length));
    }
  }

  const bandit = new ThompsonBandit(pool.map((v) => v.id));
  const visits: Visit[] = [];
  const allocationHistory: AllocationSnapshot[] = [];

  for (let i = 0; i < visitsPerGen; i++) {
    const variantId = bandit.pick(rng);
    const variant = pool.find((v) => v.id === variantId)!;
    const persona = pickWeighted(rng, personas, (p) => p.trafficWeight);
    const reading = readings.get(`${variant.id}|${persona.id}`)!;
    visits.push(sampleVisit(rng, persona, variant, reading, gen, i));
    bandit.record(variantId, visits[visits.length - 1].converted);
    if ((i + 1) % 40 === 0) {
      allocationHistory.push({ afterVisits: i + 1, shares: bandit.shares() });
    }
  }

  const metrics = pool.map((v) => computeMetrics(v, visits)).sort((a, b) => b.fitness - a.fitness);
  const winner = metrics[0];

  // Bayesian decisions on the full visit set: joint posterior gives P(best),
  // credible intervals, expected loss, and guardrail checks per variant.
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
    seed + gen * 7919
  );

  const findings = [
    {
      finding: `${winner.variantId} led generation ${gen}.`,
      evidence: `fitness=${winner.fitness.toFixed(1)}, conversion=${(winner.conversionRate * 100).toFixed(1)}%.`,
    },
    ...decisions
      .filter((d) => d.status !== "collecting")
      .map((d) => ({
        finding: `${d.variantId}: ${d.status}.`,
        evidence: d.reason,
      })),
  ];

  const report = {
    generation: gen,
    insights: `Generation ${gen}: ${winner.variantId} led with ${(winner.conversionRate * 100).toFixed(1)}% conversion.`,
    findings,
    scorecards: pool.map((v) => {
      const m = metrics.find((x) => x.variantId === v.id)!;
      return {
        variantId: v.id,
        valueClarity: clamp(4 + m.conversionRate * 40, 0, 10),
        credibility: clamp(5 + (v.sections.some((s) => s.type === "social_proof") ? 2 : 0), 0, 10),
        ctaStrength: clamp(4 + m.conversionRate * 35, 0, 10),
        audienceFit: clamp(4 + m.avgScrollDepth * 4, 0, 10),
        frictionPoints: Object.keys(m.objectionFailures).slice(0, 3).map((o) => `Unresolved: ${o}`),
        strengths: m.conversionRate > 0.03 ? ["Strong conversion"] : ["Good hero scroll"],
        summary: `${v.name}: ${(m.conversionRate * 100).toFixed(1)}% conversion.`,
      };
    }),
  };

  const offspring: PageVariant[] = [];
  if (gen < maxGenerations - 1) {
    offspring.push(breedHeuristic(pool, metrics, gen, 0));
    offspring.push(breedHeuristic(pool, metrics, gen, 1));
  }

  // Store a stratified sample of traces (metrics/decisions used the full set):
  // keep every converted/bounced-with-depth visit variety per variant, cap total.
  const perVariantCap = Math.max(20, Math.floor(storedVisits / pool.length));
  const sampled: Visit[] = [];
  for (const v of pool) {
    const forVariant = visits.filter((x) => x.variantId === v.id);
    const converted = forVariant.filter((x) => x.converted);
    const lost = forVariant.filter((x) => !x.converted);
    // Keep all conversions up to half the cap, fill the rest with losses.
    const keepConv = converted.slice(0, Math.ceil(perVariantCap / 2));
    const keepLost = lost.slice(0, perVariantCap - keepConv.length);
    sampled.push(...keepConv, ...keepLost);
  }

  return {
    genRun: {
      generation: gen,
      variantIds: pool.map((v) => v.id),
      visits: sampled,
      totalVisits: visits.length,
      metrics,
      allocationHistory,
      report,
      decisions,
      offspringIds: offspring.map((o) => o.id),
    },
    offspring,
    decisions,
  };
}

/** Run the full multi-generation heuristic experiment. */
export function runDemoExperiment(cfg: DemoRunConfig = {}): ExperimentRun {
  const seed = cfg.seed ?? DEFAULTS.seed;
  const visitsPerGeneration = cfg.visitsPerGeneration ?? DEFAULTS.visitsPerGeneration;
  const generations = cfg.generations ?? DEFAULTS.generations;

  const storedVisitsPerGeneration =
    cfg.storedVisitsPerGeneration ?? DEFAULTS.storedVisitsPerGeneration;

  const rng = makeRng(seed);
  const personaSet = getCalibratedPersonaSet();
  const allVariants: PageVariant[] = [...GENERATION_0];
  let pool = [...GENERATION_0];
  const generationRuns: GenerationRun[] = [];

  for (let gen = 0; gen < generations; gen++) {
    const { genRun, offspring, decisions } = runGeneration(
      gen,
      pool,
      rng,
      seed,
      visitsPerGeneration,
      generations,
      storedVisitsPerGeneration
    );
    generationRuns.push(genRun);
    allVariants.push(...offspring);
    if (offspring.length) {
      // Kill gate: variants with P(beat baseline) < 5% are dropped from the
      // next generation's pool. Survivors are the remaining top performers.
      const killed = new Set(
        decisions.filter((d) => d.status === "killed").map((d) => d.variantId)
      );
      const eligible = genRun.metrics.filter((m) => !killed.has(m.variantId));
      const survivors = eligible
        .slice(0, Math.max(2, pool.length - offspring.length - killed.size))
        .map((m) => pool.find((v) => v.id === m.variantId)!);
      pool = [...survivors, ...offspring];
    }
  }

  return {
    id: `run-${seed}`,
    createdAt: new Date().toISOString(),
    personaSetVersion: personaSet.version,
    variants: allVariants,
    generations: generationRuns,
  };
}

export function simulatedMetricsFromRun(run: ExperimentRun) {
  const last = run.generations[run.generations.length - 1];
  // Use metrics (computed over ALL simulated visits) rather than the stored
  // trace sample, which is deliberately stratified toward conversions.
  const totals = last.metrics.reduce(
    (acc, m) => {
      acc.visits += m.visits;
      acc.conversions += m.conversions;
      acc.scroll += m.avgScrollDepth * m.visits;
      acc.bounce += m.bounceRate * m.visits;
      return acc;
    },
    { visits: 0, conversions: 0, scroll: 0, bounce: 0 }
  );
  if (!totals.visits) return null;
  return {
    conversionRate: totals.conversions / totals.visits,
    bounceRate: totals.bounce / totals.visits,
    avgScrollDepth: totals.scroll / totals.visits,
  };
}
