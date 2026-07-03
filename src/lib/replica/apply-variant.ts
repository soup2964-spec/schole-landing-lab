import type { PageVariant, Section } from "@/lib/schema/page";
import {
  BASELINE_HTML_COPY,
  patchableSectionIds,
  REPLICA_SECTION_IDS,
  STRAY_BASELINE_FRAGMENTS,
  type ReplicaSectionId,
} from "./baseline-copy";
import { normalizeVariantForReplica } from "@/lib/deploy/normalize-variant";

export interface HtmlReplacement {
  sectionId: ReplicaSectionId;
  /** Unique substring of the text to replace (first ~24 chars is enough). */
  anchor: string;
  to: string;
}

export function getSectionBounds(
  html: string,
  sectionId: ReplicaSectionId
): { start: number; end: number } | null {
  const marker = `data-section-id="${sectionId}"`;
  const start = html.indexOf(marker);
  if (start < 0) return null;

  const others = REPLICA_SECTION_IDS.filter((id) => id !== sectionId)
    .map((id) => html.indexOf(`data-section-id="${id}"`, start + marker.length))
    .filter((i) => i > start);

  const end = others.length ? Math.min(...others) : html.length;
  return { start, end };
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function anchorNeedle(anchor: string): string {
  return anchor.slice(0, Math.min(anchor.length, 28));
}

/**
 * Find the inner HTML bounds of the RichTextContainer that contains `idx`.
 * Framer nests tags inside containers — replace the whole block, not one text node.
 */
function richTextInnerBounds(html: string, idx: number): { start: number; end: number } | null {
  const containerStart = html.lastIndexOf(
    'data-framer-component-type="RichTextContainer"',
    idx
  );
  if (containerStart < 0) return null;

  const contentStart = html.indexOf(">", containerStart);
  if (contentStart < 0) return null;

  let depth = 1;
  let pos = contentStart + 1;

  while (pos < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", pos);
    const nextClose = html.indexOf("</div>", pos);
    if (nextClose < 0) return null;

    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
      continue;
    }

    depth--;
    if (depth === 0) return { start: contentStart + 1, end: nextClose };
    pos = nextClose + 6;
  }

  return null;
}

/**
 * Replace every RichTextContainer whose plain text contains `anchor`.
 * First match gets `to`; breakpoint duplicates are cleared.
 */
export function replaceRichTextGlobally(
  html: string,
  anchor: string,
  to: string
): string {
  if (!anchor || anchor === to) return html;

  const needle = anchorNeedle(anchor);
  if (!html.includes(needle) && !html.includes(anchor)) return html;

  let out = html;
  let wrotePrimary = false;
  let searchFrom = 0;

  while (searchFrom < out.length) {
    let idx = out.indexOf(anchor, searchFrom);
    if (idx < 0) idx = out.indexOf(needle, searchFrom);
    if (idx < 0) break;

    const bounds = richTextInnerBounds(out, idx);
    if (!bounds) {
      searchFrom = idx + Math.max(needle.length, 1);
      continue;
    }

    const replacement =
      to && !wrotePrimary ? escapeHtmlText(to) : "";
    if (to && !wrotePrimary) wrotePrimary = true;

    out = out.slice(0, bounds.start) + replacement + out.slice(bounds.end);
    searchFrom = bounds.start + Math.max(replacement.length, 1);
  }

  return out;
}

/** @deprecated Use replaceRichTextGlobally — kept for scripts that import by name. */
export function replaceTextNodeInSection(
  html: string,
  _sectionId: ReplicaSectionId,
  anchor: string,
  to: string
): string {
  return replaceRichTextGlobally(html, anchor, to);
}

export function applyReplacements(html: string, replacements: HtmlReplacement[]): string {
  let out = html;
  for (const r of replacements) {
    out = replaceRichTextGlobally(out, r.anchor, r.to);
  }
  return out;
}

function splitHeadline(headline: string): [string, string] {
  const dotSpace = headline.indexOf(". ");
  if (dotSpace > 0 && dotSpace < headline.length - 2) {
    return [headline.slice(0, dotSpace + 1), headline.slice(dotSpace + 2)];
  }
  return [headline, ""];
}

function pushHeadlineChange(
  out: HtmlReplacement[],
  sectionId: ReplicaSectionId,
  baselineHeadline: string,
  variantHeadline: string
) {
  if (baselineHeadline === variantHeadline) return;

  const [b1, b2] = splitHeadline(baselineHeadline);
  const [v1, v2] = splitHeadline(variantHeadline);

  pushIfChanged(out, sectionId, b1, v1);
  if (b2 && v2) pushIfChanged(out, sectionId, b2, v2);
  else if (b2 && !v2) pushIfChanged(out, sectionId, b2, "");
}

function pushIfChanged(
  out: HtmlReplacement[],
  sectionId: ReplicaSectionId,
  anchor: string | undefined,
  to: string | undefined
) {
  if (!anchor || to === undefined || anchor === to) return;
  out.push({ sectionId, anchor, to });
}

function pushBodyChanges(
  out: HtmlReplacement[],
  sectionId: ReplicaSectionId,
  baseline: Section,
  variant: Section,
  html: string
) {
  if (variant.body === baseline.body) return;

  const htmlBodies = BASELINE_HTML_COPY[sectionId]?.body ?? [];
  const variantChunks = splitBodyForSlots(variant.body, htmlBodies.length || 1);

  if (htmlBodies.length > 0) {
    for (let i = 0; i < htmlBodies.length; i++) {
      const anchor = htmlBodies[i]!.slice(0, Math.min(htmlBodies[i]!.length, 40));
      pushIfChanged(out, sectionId, anchor, variantChunks[i] ?? "");
    }
    return;
  }

  const fallback = baseline.body.slice(0, Math.min(baseline.body.length, 40));
  if (html.includes(fallback)) {
    pushIfChanged(out, sectionId, fallback, variant.body);
  }
}

function splitBodyForSlots(body: string, slotCount: number): string[] {
  if (slotCount <= 1) return [body];
  // Framer often splits baseline copy across multiple blocks; variant body is one LLM paragraph.
  return [body, ...Array(Math.max(0, slotCount - 1)).fill("")];
}

function itemAnchor(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/^["']+|["']+$/g, "").trim();
  return cleaned.slice(0, Math.min(cleaned.length, 40));
}

function pushItemChanges(
  out: HtmlReplacement[],
  sectionId: ReplicaSectionId,
  baseline: Section,
  variant: Section
) {
  const baseItems = baseline.items ?? [];
  const varItems = variant.items ?? [];
  const htmlItemAnchors = BASELINE_HTML_COPY[sectionId]?.items ?? [];
  const count = Math.max(baseItems.length, varItems.length, Math.ceil(htmlItemAnchors.length / 2));

  for (let i = 0; i < count; i++) {
    const bi = baseItems[i];
    const vi = varItems[i];
    const pairedHtmlItems = htmlItemAnchors.length >= count * 2;
    const detailOnlyHtmlItems =
      htmlItemAnchors.length > 0 &&
      htmlItemAnchors.length === count &&
      !pairedHtmlItems;

    const titleAnchor = pairedHtmlItems
      ? itemAnchor(bi?.title) ?? itemAnchor(htmlItemAnchors[i * 2])
      : itemAnchor(bi?.title);
    const detailAnchor = pairedHtmlItems
      ? itemAnchor(bi?.detail) ?? itemAnchor(htmlItemAnchors[i * 2 + 1])
      : itemAnchor(bi?.detail) ?? (detailOnlyHtmlItems ? itemAnchor(htmlItemAnchors[i]) : undefined);

    if (!vi) {
      pushIfChanged(out, sectionId, titleAnchor, "");
      pushIfChanged(out, sectionId, detailAnchor, "");
      continue;
    }

    if (bi?.title !== vi.title) pushIfChanged(out, sectionId, titleAnchor, vi.title);
    if (bi?.detail !== vi.detail) pushIfChanged(out, sectionId, detailAnchor, vi.detail);
  }
}

export function buildReplacementsForSection(
  sectionId: ReplicaSectionId,
  baseline: Section,
  variant: Section,
  html: string
): HtmlReplacement[] {
  const out: HtmlReplacement[] = [];

  if (variant.headline !== baseline.headline) {
    const htmlHeadlines = BASELINE_HTML_COPY[sectionId]?.headline;
    if (htmlHeadlines && htmlHeadlines.length >= 2) {
      const [v1, v2] = splitHeadline(variant.headline);
      if (v2) {
        pushIfChanged(out, sectionId, htmlHeadlines[0], v1);
        pushIfChanged(out, sectionId, htmlHeadlines[1], v2);
      } else {
        pushIfChanged(out, sectionId, htmlHeadlines[0], variant.headline);
        pushIfChanged(out, sectionId, htmlHeadlines[1], "");
      }
    } else if (htmlHeadlines?.[0]) {
      pushIfChanged(out, sectionId, htmlHeadlines[0], variant.headline);
    } else {
      pushHeadlineChange(out, sectionId, baseline.headline, variant.headline);
    }
  }

  pushBodyChanges(out, sectionId, baseline, variant, html);
  pushItemChanges(out, sectionId, baseline, variant);

  if (variant.ctaLabel && variant.ctaLabel !== baseline.ctaLabel) {
    const ctaAnchor =
      BASELINE_HTML_COPY[sectionId]?.cta ?? baseline.ctaLabel ?? "Book a demo";
    pushIfChanged(out, sectionId, ctaAnchor, variant.ctaLabel);
  }

  return out;
}

export function extraReplacementsForVariant(variant: PageVariant): HtmlReplacement[] {
  const out: HtmlReplacement[] = [];
  if (variant.generation === 0) return out;

  for (const stray of STRAY_BASELINE_FRAGMENTS) {
    if (!patchableSectionIds(variant).includes(stray.sectionId)) continue;
    out.push({ sectionId: stray.sectionId, anchor: stray.anchor, to: "" });
  }
  return out;
}

export function buildVariantHtmlReplacements(
  baselineVariant: PageVariant,
  variant: PageVariant,
  html = ""
): HtmlReplacement[] {
  if (variant.id === baselineVariant.id) return [];

  const normalized = normalizeVariantForReplica(variant);
  const baselineById = new Map(baselineVariant.sections.map((s) => [s.id, s]));
  const replacements: HtmlReplacement[] = [...extraReplacementsForVariant(normalized)];
  const allowed = new Set(patchableSectionIds(normalized));

  for (const section of normalized.sections) {
    const replicaId = section.id as ReplicaSectionId;
    if (!REPLICA_SECTION_IDS.includes(replicaId) || !allowed.has(replicaId)) continue;
    const base = baselineById.get(section.id);
    if (!base) continue;
    replacements.push(
      ...buildReplacementsForSection(
        section.id as ReplicaSectionId,
        base,
        section,
        html
      )
    );
  }

  const seen = new Set<string>();
  return replacements.filter((r) => {
    const key = `${r.sectionId}:${r.anchor}:${r.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return r.anchor !== r.to;
  });
}

export function applyVariantToBaselineHtml(
  baselineHtml: string,
  baselineVariant: PageVariant,
  variant: PageVariant
): string {
  return applyReplacements(
    baselineHtml,
    buildVariantHtmlReplacements(baselineVariant, variant, baselineHtml)
  );
}
