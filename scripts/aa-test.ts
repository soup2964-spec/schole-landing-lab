/**
 * A/A test — validates the measurement pipeline itself.
 *
 * Runs the full simulation + bandit + Bayesian decision stack with SIX
 * IDENTICAL copies of the baseline page. A correct system should:
 *   1. Promote (almost) nothing — false-positive rate ≈ the 5% design level
 *   2. Kill (almost) nothing
 *   3. Allocate traffic roughly evenly (no arm should dominate without cause)
 *
 * Writes data/aa-test.json, rendered on the Results page as a validity card.
 */
import fs from "fs";
import path from "path";
import type { PageVariant } from "../src/lib/schema/page";
import type { Visit } from "../src/lib/schema/events";
import { GENERATION_0 } from "../src/config/variants";
import { getCalibratedPersonaSet } from "../src/lib/calibration/store";
import { heuristicReadPage } from "../src/lib/sim/heuristic-reading";
import { sampleVisit } from "../src/lib/sim/visit";
import { ThompsonBandit } from "../src/lib/sim/bandit";
import { makeRng, pickWeighted } from "../src/lib/sim/rng";
import { analyzeGeneration } from "../src/lib/stats/bayes";

const REPLICATIONS = 20;
const VISITS_PER_REPLICATION = 4800;
const ARMS = 6;
const BASE_SEED = 424242;

interface ReplicationResult {
  seed: number;
  promoted: number;
  killed: number;
  maxPBest: number;
  allocationShares: number[];
}

function makeIdenticalArms(): PageVariant[] {
  const base = GENERATION_0.find((v) => v.id === "v0-baseline") ?? GENERATION_0[0];
  return Array.from({ length: ARMS }, (_, i) => ({
    ...base,
    id: i === 0 ? "v0-baseline" : `aa-copy-${i}`,
    name: i === 0 ? base.name : `A/A copy ${i}`,
  }));
}

function runReplication(seed: number): ReplicationResult {
  const rng = makeRng(seed);
  const pool = makeIdenticalArms();
  const personas = getCalibratedPersonaSet().personas;

  const readings = new Map<string, ReturnType<typeof heuristicReadPage>>();
  for (const v of pool) {
    for (const p of personas) {
      // Same seed per persona across arms — pages are identical, readings must be too.
      readings.set(`${v.id}|${p.id}`, heuristicReadPage(p, { ...v, id: "v0-baseline" }, seed + p.id.length));
    }
  }

  const bandit = new ThompsonBandit(pool.map((v) => v.id));
  const visits: Visit[] = [];
  const counts = new Map(pool.map((v) => [v.id, { conv: 0, n: 0, bounce: 0 }]));

  for (let i = 0; i < VISITS_PER_REPLICATION; i++) {
    const variantId = bandit.pick(rng);
    const variant = pool.find((v) => v.id === variantId)!;
    const persona = pickWeighted(rng, personas, (p) => p.trafficWeight);
    const reading = readings.get(`${variant.id}|${persona.id}`)!;
    const visit = sampleVisit(rng, persona, variant, reading, 0, i);
    visits.push(visit);
    bandit.record(variantId, visit.converted);
    const c = counts.get(variantId)!;
    c.n++;
    if (visit.converted) c.conv++;
    if (visit.events.some((e) => e.type === "bounce")) c.bounce++;
  }

  const decisions = analyzeGeneration(
    pool.map((v) => {
      const c = counts.get(v.id)!;
      return {
        id: v.id,
        conversions: c.conv,
        visits: c.n,
        bounceRate: c.n ? c.bounce / c.n : 0,
      };
    }),
    "v0-baseline",
    seed * 31
  );

  return {
    seed,
    promoted: decisions.filter((d) => d.status === "promoted").length,
    killed: decisions.filter((d) => d.status === "killed").length,
    maxPBest: Math.max(...decisions.map((d) => d.pBest)),
    allocationShares: pool.map((v) => counts.get(v.id)!.n / VISITS_PER_REPLICATION),
  };
}

function main() {
  console.log(
    `A/A test: ${REPLICATIONS} replications × ${VISITS_PER_REPLICATION} visits × ${ARMS} identical arms\n`
  );

  const results: ReplicationResult[] = [];
  for (let r = 0; r < REPLICATIONS; r++) {
    const res = runReplication(BASE_SEED + r * 1009);
    results.push(res);
    console.log(
      `  rep ${String(r + 1).padStart(2)}: promoted=${res.promoted} killed=${res.killed} maxP(best)=${(res.maxPBest * 100).toFixed(1)}%`
    );
  }

  const falsePromotions = results.filter((r) => r.promoted > 0).length;
  const falseKills = results.filter((r) => r.killed > 0).length;
  const avgMaxPBest = results.reduce((s, r) => s + r.maxPBest, 0) / results.length;
  const allShares = results.flatMap((r) => r.allocationShares);
  const minShare = Math.min(...allShares);
  const maxShare = Math.max(...allShares);

  const summary = {
    ranAt: new Date().toISOString(),
    replications: REPLICATIONS,
    visitsPerReplication: VISITS_PER_REPLICATION,
    arms: ARMS,
    falsePromotionRate: falsePromotions / REPLICATIONS,
    falseKillRate: falseKills / REPLICATIONS,
    avgMaxPBest,
    allocationShareRange: [minShare, maxShare] as [number, number],
    expectedEvenShare: 1 / ARMS,
    verdict:
      falsePromotions / REPLICATIONS <= 0.1
        ? "PASS — false-positive rate within design tolerance"
        : "FAIL — pipeline promotes identical pages too often; check priors/thresholds",
    replicationsDetail: results,
  };

  const outPath = path.join(process.cwd(), "data", "aa-test.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log(`\nFalse promotion rate: ${(summary.falsePromotionRate * 100).toFixed(0)}% (design: ≤10%)`);
  console.log(`False kill rate:      ${(summary.falseKillRate * 100).toFixed(0)}%`);
  console.log(`Avg max P(best):      ${(avgMaxPBest * 100).toFixed(1)}% (even split would be ~${(100 / ARMS).toFixed(0)}–40%)`);
  console.log(`Allocation range:     ${(minShare * 100).toFixed(0)}%–${(maxShare * 100).toFixed(0)}% (expected ~${(100 / ARMS).toFixed(0)}%)`);
  console.log(`\n${summary.verdict}`);
  console.log(`Wrote ${outPath}`);
}

main();
