import type {
  CalibrationRecord,
  PersonaCalibrationAdjustments,
  RealMetricsSnapshot,
  SimulatedMetricsSnapshot,
} from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Compare real PostHog/GTM-instrumented traffic against simulation aggregates
 * and derive persona parameter adjustments for the next prediction run.
 */
export function computeCalibration(
  real: RealMetricsSnapshot,
  simulated: SimulatedMetricsSnapshot,
  version: number
): CalibrationRecord {
  const realConv = real.aggregate.conversionRate;
  const simConv = Math.max(simulated.conversionRate, 0.001);

  // Don't over-correct on tiny samples
  const confidence = clamp(real.aggregate.visitors / 200, 0.2, 1);
  const rawRatio = realConv / simConv;
  const ctaMultiplier = clamp(1 + (rawRatio - 1) * confidence, 0.75, 1.35);

  const scrollDelta = (real.aggregate.avgScrollDepth - simulated.avgScrollDepth) * confidence;
  const patienceSecondsDelta = Math.round(scrollDelta * 120); // ~2 min max shift

  const bounceDelta = real.aggregate.bounceRate - simulated.bounceRate;
  const skimPropensityDelta = clamp(bounceDelta * 0.4 * confidence, -0.15, 0.15);

  const variantConversionBias: Record<string, number> = {};
  for (const rv of real.byVariant) {
    const simRate = simulated.conversionRate; // global sim prior when per-variant sim unavailable
    if (rv.visitors >= 10) {
      variantConversionBias[rv.variantId] = clamp(
        1 + ((rv.conversionRate / Math.max(simRate, 0.001)) - 1) * confidence,
        0.6,
        1.5
      );
    }
  }

  const adjustments: PersonaCalibrationAdjustments = {
    ctaPropensityMultiplier: ctaMultiplier,
    patienceSecondsDelta,
    skimPropensityDelta,
    variantConversionBias,
  };

  return {
    version,
    createdAt: new Date().toISOString(),
    changelog: `Calibrated from ${real.source} (${real.aggregate.visitors} visitors, ${real.windowDays}d window). CTA propensity ×${ctaMultiplier.toFixed(2)}, patience ${patienceSecondsDelta >= 0 ? "+" : ""}${patienceSecondsDelta}s, skim ${skimPropensityDelta >= 0 ? "+" : ""}${skimPropensityDelta.toFixed(2)}.`,
    real,
    simulated,
    adjustments,
  };
}
