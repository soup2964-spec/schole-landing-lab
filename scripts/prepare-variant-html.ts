/**
 * Builds variant HTML: exact Framer layout + baked-in text swaps + in-page guard
 * so copy survives Framer hydration.
 */
import fs from "fs";
import path from "path";
import { GENERATION_0 } from "../src/config/variants";
import {
  applyVariantToBaselineHtml,
  buildVariantHtmlReplacements,
} from "../src/lib/replica/apply-variant";
import { injectLabGuard, stripLabGuard } from "../src/lib/replica/prepare-lab-html";
import { normalizeVariantForReplica } from "../src/lib/deploy/normalize-variant";
import type { PageVariant } from "../src/lib/schema/page";

const ROOT = path.join(__dirname, "..");
const BASELINE_HTML = path.join(ROOT, "public", "baseline", "index.html");
const LAB_SOURCE_HTML = path.join(ROOT, "public", "baseline", "lab-source.html");
const OUT_DIR = path.join(ROOT, "public", "baseline", "variants");
const RUN_JSON = path.join(ROOT, "data", "run.json");

function writeVariantReplica(
  baselineHtml: string,
  baselineVariant: PageVariant,
  variant: PageVariant
) {
  const normalized = normalizeVariantForReplica(variant);
  const patches = buildVariantHtmlReplacements(baselineVariant, normalized, baselineHtml);
  let html = applyVariantToBaselineHtml(baselineHtml, baselineVariant, normalized);
  html = injectLabGuard(stripLabGuard(html), patches);

  const outPath = path.join(OUT_DIR, `${variant.id}.html`);
  fs.writeFileSync(outPath, html, "utf8");

  const framerScripts = (html.match(/framerusercontent\.com\/sites/gi) ?? []).length;
  console.log(
    `  ${variant.id}: ${patches.length} swaps, guard injected, ${framerScripts} Framer refs → ${path.relative(ROOT, outPath)}`
  );
}

function loadBredVariants(): PageVariant[] {
  if (!fs.existsSync(RUN_JSON)) return [];
  try {
    const run = JSON.parse(fs.readFileSync(RUN_JSON, "utf8")) as { variants?: PageVariant[] };
    return (run.variants ?? []).filter((v) => v.generation > 0);
  } catch {
    return [];
  }
}

function main() {
  if (!fs.existsSync(BASELINE_HTML)) {
    throw new Error(`Missing ${BASELINE_HTML}. Run npm run prepare:baseline first.`);
  }

  const baselineHtml = fs.readFileSync(BASELINE_HTML, "utf8");
  const baselineVariant = GENERATION_0[0];
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const variant of GENERATION_0) {
    if (variant.id === "v0-baseline") {
      const source = fs.existsSync(LAB_SOURCE_HTML) ? LAB_SOURCE_HTML : BASELINE_HTML;
      const outPath = path.join(OUT_DIR, "v0-baseline.html");
      fs.copyFileSync(source, outPath);
      console.log(`  v0-baseline: pristine lab preview → ${path.relative(ROOT, outPath)}`);
      continue;
    }

    writeVariantReplica(baselineHtml, baselineVariant, variant);
  }

  const bred = loadBredVariants();
  for (const variant of bred) {
    writeVariantReplica(baselineHtml, baselineVariant, variant);
  }

  console.log(
    `\nWrote ${GENERATION_0.length + bred.length} variant replicas to ${OUT_DIR}`
  );
}

main();
