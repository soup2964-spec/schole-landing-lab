import type { ObjectionId } from "@/shared/schema/page";

/**
 * A PersonaReading is one pass of a persona over a page: per-section
 * reactions, objection effects, and conversion inclination. The Monte Carlo
 * visit engine samples many stochastic visits from these readings.
 *
 * Readings are produced by the heuristic simulator (see heuristic-reading.ts).
 */

export interface SectionReading {
  sectionId: string;
  /** 0-1: how compelling this section is to read carefully (vs skim). */
  appeal: number;
  /** -2..+2 */
  sentiment: number;
  thought: string;
  /** 0-1: inclination to keep scrolling after this section. */
  continueDesire: number;
  objectionEffects: { objectionId: ObjectionId; effect: "resolved" | "aggravated"; note: string }[];
}

export interface PersonaReading {
  personaId: string;
  variantId: string;
  seed: number;
  sections: SectionReading[];
  /** 0-1: probability of clicking the CTA if all critical objections are resolved by page end. */
  ctaInclination: number;
  verdict: string;
}
