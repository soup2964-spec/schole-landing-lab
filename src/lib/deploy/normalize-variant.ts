import { GENERATION_0 } from "@/config/variants";
import type { PageVariant, Section, SectionType } from "@/lib/schema/page";
import { REPLICA_SECTION_IDS, type ReplicaSectionId } from "@/lib/replica/baseline-copy";

/** Map logical section types onto Framer replica section ids for HTML patching. */
const TYPE_TO_REPLICA: Partial<Record<SectionType, ReplicaSectionId>> = {
  hero: "hero",
  how_it_works: "how",
  problem: "problem",
  features: "features",
  outcomes: "features",
  social_proof: "proof",
  credibility: "press",
  product_tour: "tour",
  compliance: "faq",
  integration: "features",
  pricing: "faq",
  faq: "faq",
  cta: "cta",
};

/**
 * Bred variants rename section ids (e.g. hero-g2-0). Remap onto replica ids so
 * prepare-variant HTML patching works.
 */
export function normalizeVariantForReplica(variant: PageVariant): PageVariant {
  const baseline = GENERATION_0[0];
  const baselineByReplica = new Map<ReplicaSectionId, Section>();
  for (const section of baseline.sections) {
    if (REPLICA_SECTION_IDS.includes(section.id as ReplicaSectionId)) {
      baselineByReplica.set(section.id as ReplicaSectionId, section);
    }
  }

  const winnerByReplica = new Map<ReplicaSectionId, Section>();
  for (const section of variant.sections) {
    const replicaId =
      (REPLICA_SECTION_IDS.includes(section.id as ReplicaSectionId)
        ? (section.id as ReplicaSectionId)
        : TYPE_TO_REPLICA[section.type]) ?? null;
    if (!replicaId) continue;
    winnerByReplica.set(replicaId, { ...section, id: replicaId });
  }

  const sections: Section[] = baseline.sections.map((base) => {
    const replicaId = base.id as ReplicaSectionId;
    const winner = winnerByReplica.get(replicaId);
    return winner ? { ...winner, id: replicaId } : base;
  });

  return { ...variant, sections };
}

/** Merge winning copy into the baseline control for production deployment. */
export function mergeWinnerIntoBaseline(
  baseline: PageVariant,
  winner: PageVariant
): PageVariant {
  const normalized = normalizeVariantForReplica(winner);
  const winnerById = new Map(normalized.sections.map((s) => [s.id, s]));

  return {
    ...baseline,
    thesis: `Production baseline — merged from ${winner.name} (${winner.id}). ${winner.thesis}`,
    sections: baseline.sections.map((s) => winnerById.get(s.id) ?? s),
  };
}
