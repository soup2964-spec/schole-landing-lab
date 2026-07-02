export interface VariantRealMetrics {
  variantId: string;
  visitors: number;
  ctaClicks: number;
  conversionRate: number;
  /** Average scroll depth 0–1 when available. */
  avgScrollDepth: number;
  /** Share of sessions with scroll_depth < 0.15 (proxy for bounce). */
  bounceRate: number;
}

export interface RealMetricsSnapshot {
  fetchedAt: string;
  source: "posthog" | "posthog+ga";
  windowDays: number;
  byVariant: VariantRealMetrics[];
  aggregate: {
    visitors: number;
    conversionRate: number;
    avgScrollDepth: number;
    bounceRate: number;
  };
}

export interface SimulatedMetricsSnapshot {
  conversionRate: number;
  bounceRate: number;
  avgScrollDepth: number;
}

export interface PersonaCalibrationAdjustments {
  /** Multiplier applied to all persona ctaPropensity values. */
  ctaPropensityMultiplier: number;
  /** Added to all persona patienceSeconds.mean (seconds). */
  patienceSecondsDelta: number;
  /** Added to all persona skimPropensity (clamped 0–1). */
  skimPropensityDelta: number;
  /** Per-variant conversion bias learned from real traffic. */
  variantConversionBias: Record<string, number>;
}

export interface CalibrationRecord {
  version: number;
  createdAt: string;
  changelog: string;
  real: RealMetricsSnapshot;
  simulated: SimulatedMetricsSnapshot;
  adjustments: PersonaCalibrationAdjustments;
}
