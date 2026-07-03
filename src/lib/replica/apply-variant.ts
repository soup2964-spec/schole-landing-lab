import type { PageVariant, Section } from "@/lib/schema/page";
import {
  BASELINE_HTML_COPY,
  REPLICA_SECTION_IDS,
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

/** Replace the HTML text node that contains `anchor` inside one section. */
export function replaceTextNodeInSection(
  html: string,
  sectionId: ReplicaSectionId,
  anchor: string,
  to: string
): string {
  if (!anchor || anchor === to) return html;
  const bounds = getSectionBounds(html, sectionId);
  if (!bounds) return html;

  const chunk = html.slice(bounds.start, bounds.end);
  const needle = anchor.slice(0, Math.min(anchor.length, 28));
  const idx = chunk.indexOf(needle);
  if (idx < 0) return html;

  const textStart = chunk.lastIndexOf(">", idx) + 1;
  const textEnd = chunk.indexOf("<", idx);
  if (textStart <= 0 || textEnd < 0) return html;

  const updated =
    chunk.slice(0, textStart) + to + chunk.slice(textEnd);
  return html.slice(0, bounds.start) + updated + html.slice(bounds.end);
}

export function applyReplacements(html: string, replacements: HtmlReplacement[]): string {
  let out = html;
  for (const r of replacements) {
    out = replaceTextNodeInSection(out, r.sectionId, r.anchor, r.to);
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

export function buildReplacementsForSection(
  sectionId: ReplicaSectionId,
  baseline: Section,
  variant: Section
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

  if (variant.body !== baseline.body) {
    const htmlBodies = BASELINE_HTML_COPY[sectionId]?.body;
    if (htmlBodies?.length) {
      const primary = htmlBodies[0];
      pushIfChanged(
        out,
        sectionId,
        primary.slice(0, Math.min(primary.length, 40)),
        variant.body
      );
      for (let i = 1; i < htmlBodies.length; i++) {
        const extra = htmlBodies[i];
        pushIfChanged(
          out,
          sectionId,
          extra.slice(0, Math.min(extra.length, 40)),
          ""
        );
      }
    } else {
      pushIfChanged(out, sectionId, baseline.body.slice(0, 40), variant.body);
    }
  }

  if (variant.ctaLabel && variant.ctaLabel !== baseline.ctaLabel) {
    pushIfChanged(out, sectionId, baseline.ctaLabel ?? "Book a demo", variant.ctaLabel);
  }

  return out;
}

export function extraReplacementsForVariant(_variant: PageVariant): HtmlReplacement[] {
  return [];
}

export function buildVariantHtmlReplacements(
  baselineVariant: PageVariant,
  variant: PageVariant
): HtmlReplacement[] {
  if (variant.id === baselineVariant.id) return [];

  const normalized = normalizeVariantForReplica(variant);
  const baselineById = new Map(baselineVariant.sections.map((s) => [s.id, s]));
  const replacements: HtmlReplacement[] = [...extraReplacementsForVariant(normalized)];

  for (const section of normalized.sections) {
    if (!REPLICA_SECTION_IDS.includes(section.id as ReplicaSectionId)) continue;
    const base = baselineById.get(section.id);
    if (!base) continue;
    replacements.push(
      ...buildReplacementsForSection(section.id as ReplicaSectionId, base, section)
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
    buildVariantHtmlReplacements(baselineVariant, variant)
  );
}
