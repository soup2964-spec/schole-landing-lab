import { GENERATION_0 } from "@/config/variants";
import type { PageVariant } from "@/lib/schema/page";
import {
  buildVariantHtmlReplacements,
  type HtmlReplacement,
} from "./apply-variant";
import { FROZEN_BASELINE_COPY, FROZEN_FRAMER_NAMES } from "./baseline-copy";

function anchorNeedle(anchor: string): string {
  return anchor.slice(0, Math.min(anchor.length, 28));
}

function isFrozenElement(el: Element): boolean {
  const name = el.getAttribute("data-framer-name");
  if (name && FROZEN_FRAMER_NAMES.has(name)) return true;
  const text = el.textContent ?? "";
  return FROZEN_BASELINE_COPY.some((frozen) => text.includes(frozen));
}

/** Replace every RichTextContainer in the document that contains the anchor. */
export function replaceRichTextGloballyInDocument(
  doc: Document,
  anchor: string,
  to: string
): boolean {
  if (!anchor) return false;
  const needle = anchorNeedle(anchor);
  const root = doc.getElementById("main") ?? doc.body;
  const containers = root.querySelectorAll(
    '[data-framer-component-type="RichTextContainer"]'
  );

  let applied = false;
  let wrotePrimary = false;

  for (const el of containers) {
    if (isFrozenElement(el)) continue;
    const text = el.textContent ?? "";
    if (!text.includes(anchor) && !text.includes(needle)) continue;

    if (to && !wrotePrimary) {
      el.textContent = to;
      wrotePrimary = true;
    } else {
      el.textContent = "";
    }
    applied = true;
  }

  return applied;
}

/** @deprecated Prefer replaceRichTextGloballyInDocument. */
export function replaceTextInSectionElement(
  section: Element,
  anchor: string,
  to: string
): boolean {
  return replaceRichTextGloballyInDocument(section.ownerDocument, anchor, to);
}

export function applyReplacementsToDocument(
  doc: Document,
  replacements: HtmlReplacement[]
): number {
  const bridge = (doc.defaultView as Window & {
    __llApplyVariantPatches?: (r: HtmlReplacement[]) => number;
  })?.__llApplyVariantPatches;

  if (bridge) return bridge(replacements);

  let applied = 0;
  for (const r of replacements) {
    if (replaceRichTextGloballyInDocument(doc, r.anchor, r.to)) applied++;
  }
  return applied;
}

export function variantDomReplacements(variant: PageVariant): HtmlReplacement[] {
  const baseline = GENERATION_0[0];
  if (variant.id === baseline.id) return [];
  return buildVariantHtmlReplacements(baseline, variant);
}

/** True when any baseline anchor text reappeared after Framer hydration. */
export function needsVariantPatch(doc: Document, variant: PageVariant): boolean {
  if (variant.id === "v0-baseline") return false;
  const root = doc.getElementById("main") ?? doc.body;
  const text = root.textContent ?? "";

  return variantDomReplacements(variant).some((r) => {
    if (r.to && text.includes(r.to)) return false;
    if (r.to.length >= 12) {
      const hint = r.to.slice(0, Math.min(r.to.length, 48));
      if (text.includes(hint)) return false;
    }
    const needle = anchorNeedle(r.anchor);
    return (r.anchor && text.includes(r.anchor)) || (needle && text.includes(needle));
  });
}

/**
 * Framer hydrates after first paint and restores CMS copy from embedded state,
 * undoing static HTML edits. Re-apply swaps until variant text sticks.
 */
export function scheduleVariantDomPatch(
  doc: Document,
  variant: PageVariant,
  onPatched?: () => void
): () => void {
  const replacements = variantDomReplacements(variant);
  if (!replacements.length) return () => {};

  let stopped = false;
  const run = () => {
    if (stopped) return;
    applyReplacementsToDocument(doc, replacements);
    onPatched?.();
  };

  run();
  const timers = [50, 150, 400, 900, 2000, 4000].map((ms) => setTimeout(run, ms));

  let debounce: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    if (stopped || !needsVariantPatch(doc, variant)) return;
    clearTimeout(debounce);
    debounce = setTimeout(run, 30);
  });

  observer.observe(doc.documentElement, {
    subtree: true,
    characterData: true,
    childList: true,
  });

  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
    clearTimeout(debounce);
    observer.disconnect();
  };
}
