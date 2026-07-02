/**
 * Extracts the Framer HTML snapshot from the transcript (or uses the saved file),
 * fixes encoding, injects data-section-id markers for simulation/replay, and writes
 * public/baseline/index.html — the exact schole.ai landing page served statically.
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "baseline", "index.html");
const SRC = path.join(ROOT, "public", "baseline", "schole-original.html");

/** Unique anchor text → section id (must match variants.ts baseline sections). */
const SECTION_MARKERS: { anchor: string; id: string }[] = [
  { anchor: "Faster competency. Higher engagement.", id: "hero" },
  { anchor: "Learn the new way with", id: "how" },
  { anchor: "The adoption gap is real.", id: "problem" },
  { anchor: "adapts to each person", id: "features" },
  { anchor: "What your", id: "tour" },
  { anchor: "Teams at these organizations are already learning on", id: "proof" },
  { anchor: "Backed by the best.", id: "press" },
  { anchor: "How is Scholé different from platforms like Coursera", id: "faq" },
  { anchor: "Ready to turn AI tools", id: "cta" },
];

function loadHtml(): string {
  if (fs.existsSync(SRC)) {
    let html = fs.readFileSync(SRC, "utf8");
    if (html.includes("ScholÃ©")) {
      html = Buffer.from(html, "latin1").toString("utf8");
    }
    return html;
  }
  throw new Error(`Missing ${SRC}. Re-run extraction from transcript.`);
}

function injectSectionMarker(html: string, anchor: string, sectionId: string): string {
  const idx = html.indexOf(anchor);
  if (idx < 0) {
    console.warn(`  ⚠ anchor not found: "${anchor.slice(0, 50)}..."`);
    return html;
  }

  // Walk backward to the nearest block-level opening tag (section/div/header)
  const before = html.slice(0, idx);
  const tagMatch = before.match(/<(section|div|header)([^>]*)>(?![\s\S]*<(section|div|header)[^>]*>[\s\S]{0,800}$)/);
  // Simpler: find last opening tag within 2000 chars
  const windowStart = Math.max(0, idx - 2500);
  const window = html.slice(windowStart, idx);
  const tags = [...window.matchAll(/<(section|div|header)(\s[^>]*)?>/g)];
  if (tags.length === 0) {
    // Fallback: insert invisible anchor div
    const marker = `<div data-section-id="${sectionId}" id="section-${sectionId}" aria-hidden="true" style="scroll-margin-top:80px"></div>`;
    return html.slice(0, idx) + marker + html.slice(idx);
  }
  const lastTag = tags[tags.length - 1];
  const tagStart = windowStart + (lastTag.index ?? 0);
  const fullTag = lastTag[0];
  if (fullTag.includes("data-section-id")) return html;

  const injected = fullTag.replace(/^<(section|div|header)/, `<$1 data-section-id="${sectionId}" id="section-${sectionId}"`);
  return html.slice(0, tagStart) + injected + html.slice(tagStart + fullTag.length);
}

function injectHighlightStyles(html: string): string {
  const style = `
<style id="landing-lab-overrides">
  [data-section-id].ll-highlight {
    outline: 4px solid rgb(251, 191, 36) !important;
    outline-offset: 4px !important;
  }
</style>`;
  return html.replace("</head>", `${style}\n</head>`);
}

function main() {
  console.log("Preparing baseline HTML...");
  let html = loadHtml();

  for (const { anchor, id } of SECTION_MARKERS) {
    html = injectSectionMarker(html, anchor, id);
  }

  html = injectHighlightStyles(html);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html, "utf8");
  console.log(`Wrote ${OUT} (${(html.length / 1024).toFixed(0)} KB)`);

  for (const { anchor, id } of SECTION_MARKERS) {
    const ok = html.includes(`data-section-id="${id}"`);
    console.log(`  ${ok ? "✓" : "✗"} ${id}`);
  }
}

main();
