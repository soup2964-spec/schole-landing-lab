import { GENERATION_0 } from "@/config/variants";
import type { PageVariant } from "@/lib/schema/page";
import {
  applyVariantToBaselineHtml,
  buildVariantHtmlReplacements,
} from "./apply-variant";
import { injectLabGuard, stripLabGuard } from "./prepare-lab-html";

const BASELINE_ID = "v0-baseline";
const GEN0_IDS = new Set(GENERATION_0.map((v) => v.id));

/**
 * URL for iframe previews and full-page replicas.
 * Gen-0 challengers ship as static HTML in git; bred variants are rendered on demand.
 */
export function staticReplicaPath(variantId: string): string | null {
  if (variantId === BASELINE_ID) return "/baseline/variants/v0-baseline.html";
  if (variantId === "production") return "/baseline/variants/production.html";
  if (GEN0_IDS.has(variantId)) return `/baseline/variants/${variantId}.html`;
  if (variantId.startsWith("g") || /^v\d/.test(variantId)) {
    return `/api/variants/${encodeURIComponent(variantId)}/html`;
  }
  return null;
}

/** Bred variants: baseline HTML + text swaps + hydration guard. */
export function replicaHtmlWithGuard(
  baselineHtml: string,
  variant: PageVariant
): string {
  const baselineVariant = GENERATION_0[0];
  if (variant.id === baselineVariant.id) return baselineHtml;
  const patches = buildVariantHtmlReplacements(baselineVariant, variant, baselineHtml);
  const html = applyVariantToBaselineHtml(baselineHtml, baselineVariant, variant);
  return injectLabGuard(stripLabGuard(html), patches);
}

export function shouldUseReplica(_variant: PageVariant): boolean {
  return true;
}
