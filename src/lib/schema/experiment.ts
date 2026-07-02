import type { PageVariant } from "./page";
import type { Visit, VariantMetrics } from "./events";
import type { VariantDecision } from "@/lib/stats/bayes";

/** Evaluator agent's structured rubric per variant. Judge/actor separation:
 *  the evaluator never generates pages, it only scores and diagnoses. */
export interface Scorecard {
  variantId: string;
  /** Each 0-10 */
  valueClarity: number;
  credibility: number;
  ctaStrength: number;
  audienceFit: number;
  frictionPoints: string[];
  strengths: string[];
  summary: string;
}

export interface AllocationSnapshot {
  /** Visit index at which this snapshot was taken. */
  afterVisits: number;
  /** variantId -> share of recent traffic assigned by Thompson sampling. */
  shares: Record<string, number>;
}

export interface GenerationReport {
  generation: number;
  /** Evaluator's plain-English analysis of what the data says. */
  insights: string;
  /** Key findings as bullets, each tied to evidence. */
  findings: { finding: string; evidence: string }[];
  scorecards: Scorecard[];
}

export interface GenerationRun {
  generation: number;
  variantIds: string[];
  /** Stored visit traces. May be a stratified sample when totalVisits is larger. */
  visits: Visit[];
  /** Full simulated visit count (metrics/decisions computed over all of them). */
  totalVisits?: number;
  metrics: VariantMetrics[];
  allocationHistory: AllocationSnapshot[];
  report: GenerationReport;
  /** Bayesian promote/kill/collect decisions with credible intervals. */
  decisions?: VariantDecision[];
  /** Variants bred from this generation's results (appear in gen N+1). */
  offspringIds: string[];
}

/** The complete stored experiment: everything the dashboard renders. */
export interface ExperimentRun {
  id: string;
  createdAt: string;
  personaSetVersion: number;
  variants: PageVariant[];
  generations: GenerationRun[];
}
