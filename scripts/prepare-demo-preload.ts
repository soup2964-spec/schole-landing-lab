/**
 * Precompute generation-0 readings, simulation, metrics, and report for demo mode.
 * Writes src/config/demo-preload-gen0.json (committed to git).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { GENERATION_0 } from "../src/config/variants";
import { getCalibratedPersonaSet } from "../src/lib/calibration/store";
import { buildComputedReport } from "../src/lib/evolve/computed-report";
import { DEMO_PRELOAD_SEED } from "../src/lib/evolve/demo-preload-constants";
import { heuristicReadPage } from "../src/lib/sim/heuristic-reading";
import { sampleVisit } from "../src/lib/sim/visit";
import { ThompsonBandit } from "../src/lib/sim/bandit";
import { computeMetrics } from "../src/lib/sim/metrics";
import { makeRng, pickWeighted } from "../src/lib/sim/rng";
import { analyzeGeneration } from "../src/lib/stats/bayes";
import type { Visit } from "../src/lib/schema/events";

const VISITS_PER_GEN = Number(process.env.LLM_VISITS_PER_GEN ?? 4800);

function sampleVisitsForStorage(all: Visit[], poolIds: string[], cap = 160): Visit[] {
  const perVariant = Math.max(12, Math.floor(cap / poolIds.length));
  const out: Visit[] = [];
  for (const id of poolIds) {
    const forVariant = all.filter((v) => v.variantId === id);
    const converted = forVariant.filter((v) => v.converted);
    const lost = forVariant.filter((v) => !v.converted);
    out.push(
      ...converted.slice(0, Math.ceil(perVariant / 2)),
      ...lost.slice(0, perVariant - Math.ceil(perVariant / 2))
    );
  }
  return out.slice(0, cap);
}

const OUT = path.join(process.cwd(), "src", "config", "demo-preload-gen0.json");

async function main() {
  const seed = DEMO_PRELOAD_SEED;
  const visitsPerGeneration = VISITS_PER_GEN;
  const rng = makeRng(seed);
  const personaSet = await getCalibratedPersonaSet();
  const personas = personaSet.personas;
  const pool = [...GENERATION_0];
  const gen = 0;

  console.log(`Computing demo preload (seed=${seed}, ${visitsPerGeneration} visits)...`);

  const totalReadings = pool.length * personas.length;
  const readings = new Map<string, ReturnType<typeof heuristicReadPage>[]>();
  for (const variant of pool) {
    for (const persona of personas) {
      const key = `${variant.id}|${persona.id}`;
      readings.set(key, [
        heuristicReadPage(persona, variant, seed + gen * 100 + persona.id.length),
      ]);
    }
  }

  const bandit = new ThompsonBandit(pool.map((v) => v.id));
  const visits: Visit[] = [];
  const allocationHistory: { afterVisits: number; shares: Record<string, number> }[] = [];
  const snapshotEvery = Math.max(1, Math.floor(visitsPerGeneration / 20));

  for (let i = 0; i < visitsPerGeneration; i++) {
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
      independentReadings: personas.length,
    })),
    baselineId,
    seed + gen * 7919
  );
  const report = buildComputedReport(gen, pool, metrics, decisions);
  const storedVisits = sampleVisitsForStorage(
    visits,
    pool.map((v) => v.id)
  );

  const snapshot = {
    version: 1 as const,
    seed,
    pool,
    metrics,
    decisions,
    report,
    visits: storedVisits,
    allocationHistory,
    totalReadings,
    totalVisits: visits.length,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`Wrote ${OUT}`);
  console.log(`  ${storedVisits.length} sample visits (from ${visits.length} simulated)`);
  console.log(`  top variant: ${metrics[0]?.variantId} fitness=${metrics[0]?.fitness.toFixed(1)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
