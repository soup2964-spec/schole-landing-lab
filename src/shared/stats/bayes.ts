import { makeRng, sampleBeta } from "@/lab/simulation/rng";
export {
  DECISION_THRESHOLDS,
  EVIDENCE_VISITS_PER_READING,
  PRIOR,
} from "@/config/thresholds";
import {
  DECISION_THRESHOLDS,
  EVIDENCE_VISITS_PER_READING,
  PRIOR,
} from "@/config/thresholds";

/**
 * Bayesian evaluation for adaptively-allocated (Thompson sampled) experiments.
 *
 * Why not t-tests: bandit allocation violates fixed-allocation assumptions, and
 * the live loop evaluates continuously (peeking). Posterior probability-of-best
 * plus expected loss is an always-valid stopping rule (industry standard for
 * Bayesian A/B engines), so evaluation can happen at any time without inflating
 * false positives.
 *
 * Prior / thresholds: see `@/config/thresholds`.
 */

export interface ArmCounts {
  id: string;
  conversions: number;
  visits: number;
  bounceRate: number;
  /**
   * Number of independent judgments (heuristic persona readings)
   * backing this arm's visit count. When provided, the posterior
   * is capped so it can't be more confident than that independent evidence
   * justifies (see EVIDENCE_VISITS_PER_READING). Omit to fall back to the
   * old (overconfident) behavior of trusting the raw visit count.
   */
  independentReadings?: number;
}

export type DecisionStatus = "promoted" | "killed" | "collecting";

export interface VariantDecision {
  variantId: string;
  visits: number;
  conversions: number;
  /**
   * Visits actually used to compute the posterior after capping by
   * independent evidence. Equal to `visits` when no cap was supplied or it
   * wasn't binding — different from `visits` is a sign the raw visit count
   * would have overstated confidence.
   */
  effectiveVisits: number;
  /** Independent readings behind this arm, if supplied. */
  independentReadings: number | null;
  /** Posterior mean conversion rate (shrunk toward the 3% prior). */
  posteriorMean: number;
  /** 95% credible interval on conversion rate. */
  ci95: [number, number];
  /** P(this arm has the highest true conversion rate). */
  pBest: number;
  /** P(this arm beats the baseline arm). */
  pBeatBaseline: number;
  /** Expected loss (regret) of choosing this arm, in percentage points. */
  expectedLossPp: number;
  guardrailBounceOk: boolean;
  status: DecisionStatus;
  reason: string;
}

/**
 * Joint posterior analysis via seeded Monte Carlo. One set of draws answers
 * P(best), P(beat baseline), expected loss, and credible intervals — no
 * pairwise-test multiple-comparison corrections needed.
 */
export function analyzeGeneration(
  arms: ArmCounts[],
  baselineId: string,
  seed = 987654321
): VariantDecision[] {
  const rng = makeRng(seed);
  const { draws } = DECISION_THRESHOLDS;
  const k = arms.length;
  if (k === 0) return [];

  const baselineIdx = Math.max(
    0,
    arms.findIndex((a) => a.id === baselineId)
  );

  // Cap statistical confidence by independent evidence (see
  // EVIDENCE_VISITS_PER_READING doc comment). Rate is preserved; only the
  // effective sample size shrinks.
  const effArms = arms.map((a) => {
    if (!a.independentReadings || a.independentReadings <= 0) {
      return { visits: a.visits, conversions: a.conversions };
    }
    const cap = a.independentReadings * EVIDENCE_VISITS_PER_READING;
    if (a.visits <= cap) return { visits: a.visits, conversions: a.conversions };
    const scale = cap / a.visits;
    return {
      visits: Math.max(1, Math.round(a.visits * scale)),
      conversions: Math.round(a.conversions * scale),
    };
  });

  // samples[i] = sorted-later array of posterior draws for arm i
  const samples: Float64Array[] = arms.map(() => new Float64Array(draws));
  const bestCounts = new Array<number>(k).fill(0);
  const beatBaselineCounts = new Array<number>(k).fill(0);
  const lossSums = new Array<number>(k).fill(0);

  for (let d = 0; d < draws; d++) {
    let maxVal = -1;
    let maxIdx = 0;
    const draw = new Array<number>(k);
    for (let i = 0; i < k; i++) {
      const a = effArms[i];
      const v = sampleBeta(rng, PRIOR.alpha + a.conversions, PRIOR.beta + (a.visits - a.conversions));
      draw[i] = v;
      samples[i][d] = v;
      if (v > maxVal) {
        maxVal = v;
        maxIdx = i;
      }
    }
    bestCounts[maxIdx]++;
    for (let i = 0; i < k; i++) {
      lossSums[i] += maxVal - draw[i];
      if (i !== baselineIdx && draw[i] > draw[baselineIdx]) beatBaselineCounts[i]++;
    }
  }

  const baselineBounce = arms[baselineIdx].bounceRate;

  return arms.map((a, i) => {
    const eff = effArms[i];
    const evidenceCapped = eff.visits < a.visits;
    const sorted = samples[i].slice().sort();
    const ci95: [number, number] = [
      sorted[Math.floor(draws * 0.025)],
      sorted[Math.floor(draws * 0.975)],
    ];
    const posteriorMean =
      (PRIOR.alpha + eff.conversions) / (PRIOR.alpha + PRIOR.beta + eff.visits);
    const pBest = bestCounts[i] / draws;
    const pBeatBaseline = i === baselineIdx ? 0.5 : beatBaselineCounts[i] / draws;
    const expectedLossPp = (lossSums[i] / draws) * 100;
    const guardrailBounceOk =
      i === baselineIdx ||
      a.bounceRate <= baselineBounce * DECISION_THRESHOLDS.guardrailBounceRelMax;

    let status: DecisionStatus = "collecting";
    let reason: string;
    const evidenceNote = evidenceCapped
      ? ` Confidence capped to ~${eff.visits} effective visits (${a.independentReadings} independent readings) — raw visit count would overstate certainty.`
      : "";

    if (
      pBest >= DECISION_THRESHOLDS.promotePBest &&
      expectedLossPp <= DECISION_THRESHOLDS.promoteMaxExpectedLoss * 100 &&
      guardrailBounceOk
    ) {
      status = "promoted";
      reason = `P(best)=${(pBest * 100).toFixed(1)}% ≥ 95% with expected loss ${expectedLossPp.toFixed(3)}pp — statistically confident winner.${evidenceNote}`;
    } else if (i !== baselineIdx && pBeatBaseline < DECISION_THRESHOLDS.killPBeatBaseline) {
      status = "killed";
      reason = `P(beats baseline)=${(pBeatBaseline * 100).toFixed(1)}% < 5% — reliably worse than the control.${evidenceNote}`;
    } else if (!guardrailBounceOk) {
      reason = `Guardrail violated: bounce ${(a.bounceRate * 100).toFixed(0)}% exceeds baseline ${(baselineBounce * 100).toFixed(0)}% by >10% relative — blocked from promotion.`;
    } else {
      reason = `P(best)=${(pBest * 100).toFixed(1)}%, expected loss ${expectedLossPp.toFixed(3)}pp — evidence insufficient for a promote/kill decision (n=${a.visits}).${evidenceNote}`;
    }

    return {
      variantId: a.id,
      visits: a.visits,
      conversions: a.conversions,
      effectiveVisits: eff.visits,
      independentReadings: a.independentReadings ?? null,
      posteriorMean,
      ci95,
      pBest,
      pBeatBaseline,
      expectedLossPp,
      guardrailBounceOk,
      status,
      reason,
    };
  });
}

/**
 * Sample-size guidance: approximate visits/arm needed to detect a relative
 * lift over baseline at ~80% power (two-sided z-test approximation — used as
 * a planning heuristic, not the decision rule).
 */
export function requiredVisitsPerArm(baselineRate: number, relativeLift: number): number {
  const p = baselineRate;
  const delta = p * relativeLift;
  return Math.ceil((16 * p * (1 - p)) / (delta * delta));
}
