import type { PageVariant, Section } from "@/lib/schema/page";
import {
  BASELINE_HTML_COPY,
  FROZEN_BASELINE_COPY,
  patchableSectionIds,
  REPLICA_SECTION_IDS,
  STRAY_BASELINE_FRAGMENTS,
  type ReplicaSectionId,
} from "./baseline-copy";
import { SECTION_MARKERS } from "./section-markers";
import { normalizeVariantForReplica } from "@/lib/deploy/normalize-variant";

export interface HtmlReplacement {
  sectionId: ReplicaSectionId;
  /** Unique substring of the text to replace (first ~24 chars is enough). */
  anchor: string;
  to: string;
  /**
   * Replace from the anchor to the END of the containing text node, not just
   * the anchor substring. Required for body/item swaps whose anchors are
   * 40-char prefixes (the snapshot HTML has mojibake characters that prevent
   * full-string matches); without it the rest of the baseline paragraph leaks
   * in after the new copy.
   */
  fullText?: boolean;
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isFrozenAnchor(anchor: string): boolean {
  return FROZEN_BASELINE_COPY.some((frozen) => anchor.includes(frozen) || frozen.includes(anchor));
}

/**
 * Section boundaries derived from baseline copy anchor positions.
 *
 * lab-source.html has no data-section-id markers, and the page copy lives in
 * static framer-text elements (h1/h2/p/span), NOT in Framer's hydration JSON
 * (which is only route/breakpoint metadata) or RichTextContainer nodes (only
 * two exist). Each section is located by the first appearing baseline
 * headline/body/item string; ranges run to the next section's start in DOM order.
 */
export function computeSectionBoundaries(
  html: string
): Map<ReplicaSectionId, { start: number; end: number }> {
  const positions: { id: ReplicaSectionId; start: number }[] = [];
  // SECTION_MARKERS anchors are contiguous substrings that reliably locate a
  // section even when the full baseline headline is split across styled spans.
  const markerAnchors = new Map<string, string>(
    SECTION_MARKERS.map((m) => [m.id as string, m.anchor])
  );
  for (const id of REPLICA_SECTION_IDS) {
    const c = BASELINE_HTML_COPY[id];
    const probes = [
      markerAnchors.get(id) ?? "",
      ...(c.headline ?? []),
      ...(c.body ?? []),
      ...(c.items ?? []),
      ...(c.cta ? [c.cta] : []),
    ];
    let earliest = -1;
    for (const p of probes) {
      if (!p) continue;
      const idx = html.indexOf(p);
      if (idx >= 0 && (earliest < 0 || idx < earliest)) earliest = idx;
    }
    if (earliest >= 0) positions.push({ id, start: earliest });
  }
  positions.sort((a, b) => a.start - b.start);
  const bounds = new Map<ReplicaSectionId, { start: number; end: number }>();
  for (let i = 0; i < positions.length; i++) {
    const end = i + 1 < positions.length ? positions[i + 1].start : html.length;
    bounds.set(positions[i].id, { start: positions[i].start, end });
  }
  return bounds;
}

export function getSectionBounds(
  html: string,
  sectionId: ReplicaSectionId
): { start: number; end: number } | null {
  return computeSectionBoundaries(html).get(sectionId) ?? null;
}

/** Both the literal and HTML-escaped forms of an anchor (the DOM may use either). */
function anchorForms(anchor: string): string[] {
  const escaped = escapeHtmlText(anchor);
  return escaped !== anchor ? [anchor, escaped] : [anchor];
}

function replaceAllInRange(
  html: string,
  start: number,
  end: number,
  anchor: string,
  replacement: string,
  fullText = false
): string {
  if (!anchor) return html;
  const occ: { idx: number; len: number }[] = [];
  for (const f of anchorForms(anchor)) {
    let k = start;
    while (k < end) {
      const idx = html.indexOf(f, k);
      if (idx < 0 || idx + f.length > end) break;
      let len = f.length;
      if (fullText) {
        // Swallow the rest of the text node (up to the next tag) so the tail
        // of the baseline paragraph can't leak in after the new copy.
        const tagIdx = html.indexOf("<", idx + f.length);
        if (tagIdx > 0 && tagIdx <= end) len = tagIdx - idx;
      }
      occ.push({ idx, len });
      k = idx + len;
    }
  }
  occ.sort((a, b) => a.idx - b.idx);
  // Drop overlapping matches (literal and escaped forms shouldn't overlap, but be safe).
  const dedup: typeof occ = [];
  for (const o of occ) {
    const prev = dedup[dedup.length - 1];
    if (prev && o.idx < prev.idx + prev.len) continue;
    dedup.push(o);
  }
  let out = html;
  for (let i = dedup.length - 1; i >= 0; i--) {
    out = out.slice(0, dedup[i].idx) + replacement + out.slice(dedup[i].idx + dedup[i].len);
  }
  return out;
}

/**
 * Some Framer headlines are split across a styled `<span>` prefix + a trailing
 * text node, e.g. `<span ...>Learning that </span>adapts to each person</p>`.
 * The full anchor isn't a contiguous string, so literal replace misses it.
 * Detect the `</span>` split point: replace the trailing suffix with the variant
 * text and clear the styled prefix (leaving an empty span, layout intact).
 */
function findSpanSplit(
  html: string,
  start: number,
  end: number,
  anchor: string
): { prefix: string; suffix: string } | null {
  for (let cut = anchor.length - 1; cut >= 1; cut--) {
    const prefix = anchor.slice(0, cut);
    const suffix = anchor.slice(cut);
    if (suffix.length < 4) continue;
    const probe = prefix + "</span>";
    // The styled prefix may sit just before the section start when bounds are
    // derived from a suffix-only SECTION_MARKER anchor.
    const searchFrom = Math.max(0, start - prefix.length - 48);
    let idx = html.indexOf(probe, searchFrom);
    while (idx >= 0 && idx < end) {
      const suffixIdx = html.indexOf(suffix, idx + probe.length);
      if (suffixIdx >= 0 && suffixIdx + suffix.length <= end) {
        return { prefix, suffix };
      }
      idx = html.indexOf(probe, idx + 1);
    }
  }
  return null;
}

function patchAnchorIndex(
  html: string,
  start: number,
  end: number,
  anchor: string
): number {
  for (const f of anchorForms(anchor)) {
    const i = html.indexOf(f, start);
    if (i >= 0 && i + f.length <= end) return i;
  }
  const split = findSpanSplit(html, start, end, anchor);
  if (split) {
    const i = html.indexOf(split.suffix, start);
    if (i >= 0 && i < end) return i;
  }
  return -1;
}

function applyPatchInSection(
  html: string,
  start: number,
  end: number,
  anchor: string,
  to: string,
  fullText = false
): string {
  const escaped = escapeHtmlText(to);
  if (anchorPresentInRange(html, start, end, anchor)) {
    return replaceAllInRange(html, start, end, anchor, escaped, fullText);
  }
  const split = findSpanSplit(html, start, end, anchor);
  if (split) {
    let out = replaceAllInRange(html, start, end, split.suffix, escaped, fullText);
    out = replaceAllInRange(out, start, end, split.prefix, "");
    return out;
  }
  return html;
}

function anchorPresentInRange(html: string, start: number, end: number, anchor: string): boolean {
  for (const f of anchorForms(anchor)) {
    const idx = html.indexOf(f, start);
    if (idx >= 0 && idx + f.length <= end) return true;
  }
  return false;
}

/**
 * Apply copy replacements to the static framer-text DOM, scoped per section.
 *
 * Replaces the baseline anchor text (inside h1/h2/p/span.framer-text) with the
 * variant's HTML-escaped text, preserving wrapper elements, classes, and styles.
 * Responsive duplicates within the same section all receive the new text. Patches
 * never touch other sections (e.g. hero "Book a demo" won't bleed into the CTA).
 */
export function applyReplacements(html: string, replacements: HtmlReplacement[]): string {
  const bounds = computeSectionBoundaries(html);
  const bySection = new Map<ReplicaSectionId, HtmlReplacement[]>();
  for (const r of replacements) {
    if (isFrozenAnchor(r.anchor)) continue;
    if (!bySection.has(r.sectionId)) bySection.set(r.sectionId, []);
    bySection.get(r.sectionId)!.push(r);
  }
  // Process sections right-to-left so earlier section offsets stay valid.
  const sections = [...bounds.entries()].sort((a, b) => b[1].start - a[1].start);
  let out = html;
  for (const [id, b] of sections) {
    const patches = bySection.get(id);
    if (!patches?.length) continue;
    // Within a section, apply rightmost-first so earlier occurrence offsets stay valid.
    const ordered = [...patches].sort(
      (a, b2) => patchAnchorIndex(out, b.start, b.end, b2.anchor) - patchAnchorIndex(out, b.start, b.end, a.anchor)
    );
    for (const r of ordered) {
      out = applyPatchInSection(out, b.start, b.end, r.anchor, r.to, r.fullText);
    }
  }
  return out;
}

/** @deprecated kept for scripts that import by name — use applyReplacements. */
export function replaceRichTextGlobally(
  html: string,
  anchor: string,
  to: string
): string {
  if (!anchor || isFrozenAnchor(anchor)) return html;
  return replaceAllInRange(html, 0, html.length, anchor, escapeHtmlText(to));
}

/** @deprecated kept for scripts that import by name. */
export function replaceTextNodeInSection(
  html: string,
  _sectionId: ReplicaSectionId,
  anchor: string,
  to: string
): string {
  return replaceRichTextGlobally(html, anchor, to);
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
  to: string | undefined,
  fullText = false
) {
  if (!anchor || to === undefined || anchor === to) return;
  out.push({ sectionId, anchor, to, ...(fullText ? { fullText } : {}) });
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
      // Anchor on a prefix, but replace the WHOLE text node: the snapshot HTML
      // contains mojibake (U+FFFD) where curly quotes were, so full-string
      // anchors never match and a prefix-only replace leaks the baseline tail.
      const anchor = htmlBodies[i]!.slice(0, Math.min(htmlBodies[i]!.length, 40));
      pushIfChanged(out, sectionId, anchor, variantChunks[i] ?? "", true);
    }
    return;
  }

  const fallback = baseline.body.slice(0, Math.min(baseline.body.length, 40));
  if (html.includes(fallback)) {
    pushIfChanged(out, sectionId, fallback, variant.body, true);
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
  const htmlAnchors = BASELINE_HTML_COPY[sectionId]?.items ?? [];
  if (!baseItems.length && !varItems.length) return;

  // HTML anchors are (title, detail) pairs when even-index entries match
  // baseline item titles (e.g. features); otherwise they are detail-only
  // fragments (e.g. proof quotes).
  const paired =
    htmlAnchors.length >= 2 &&
    baseItems.some((b) =>
      htmlAnchors.some((a, i) => i % 2 === 0 && a === b.title)
    );

  if (paired) {
    // Anchor on the REAL HTML strings — the config item text can drift from
    // the snapshot (punctuation, extra sentences), so config anchors miss.
    const slotCount = Math.floor(htmlAnchors.length / 2);
    for (let slot = 0; slot < slotCount; slot++) {
      const titleText = htmlAnchors[slot * 2]!;
      const detailText = htmlAnchors[slot * 2 + 1]!;
      const baseIdx = baseItems.findIndex((b) => b.title === titleText);
      const bi = baseIdx >= 0 ? baseItems[baseIdx] : baseItems[slot];
      const vi = baseIdx >= 0 ? varItems[baseIdx] : varItems[slot];
      const titleAnchor = itemAnchor(titleText);
      const detailAnchor = itemAnchor(detailText);

      if (!vi) {
        pushIfChanged(out, sectionId, titleAnchor, "", true);
        pushIfChanged(out, sectionId, detailAnchor, "", true);
        continue;
      }
      if (vi.title !== (bi?.title ?? titleText)) {
        pushIfChanged(out, sectionId, titleAnchor, vi.title, true);
      }
      if (vi.detail !== (bi?.detail ?? detailText)) {
        pushIfChanged(out, sectionId, detailAnchor, vi.detail, true);
      }
    }
    return;
  }

  const count = Math.max(baseItems.length, varItems.length, htmlAnchors.length);
  for (let i = 0; i < count; i++) {
    const bi = baseItems[i];
    const vi = varItems[i];
    const titleAnchor = itemAnchor(bi?.title);
    const detailAnchor =
      itemAnchor(bi?.detail) ??
      (htmlAnchors.length ? itemAnchor(htmlAnchors[i]) : undefined);

    if (!vi) {
      pushIfChanged(out, sectionId, titleAnchor, "", true);
      pushIfChanged(out, sectionId, detailAnchor, "", true);
      continue;
    }

    if (bi?.title !== vi.title) pushIfChanged(out, sectionId, titleAnchor, vi.title, true);
    if (bi?.detail !== vi.detail) pushIfChanged(out, sectionId, detailAnchor, vi.detail, true);
  }
}

export function buildReplacementsForSection(
  sectionId: ReplicaSectionId,
  baseline: Section,
  variant: Section,
  html: string,
  opts?: { patchCta?: boolean }
): HtmlReplacement[] {
  const out: HtmlReplacement[] = [];
  const patchCta = opts?.patchCta ?? true;

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

  if (patchCta && variant.ctaLabel && variant.ctaLabel !== baseline.ctaLabel) {
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
    out.push({ sectionId: stray.sectionId, anchor: stray.anchor, to: "", fullText: true });
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
  const patchCta = normalized.generation === 0;

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
        html,
        { patchCta }
      )
    );
  }

  const seen = new Set<string>();
  return replacements.filter((r) => {
    if (isFrozenAnchor(r.anchor)) return false;
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
