import fs from "fs";
import path from "path";
import { GENERATION_0 } from "@/config/variants";
import type { PageVariant } from "@/lib/schema/page";
import { buildVariantHtmlReplacements } from "@/lib/replica/apply-variant";
import { replicaHtmlWithGuard } from "@/lib/replica/paths";
import { normalizeVariantForReplica } from "./normalize-variant";

const ROOT = process.cwd();
const BASELINE_HTML_PATH = path.join(ROOT, "public", "baseline", "index.html");
const LAB_SOURCE_HTML_PATH = path.join(ROOT, "public", "baseline", "lab-source.html");
const VARIANTS_DIR = path.join(ROOT, "public", "baseline", "variants");

export interface HtmlWriteResult {
  variantId: string;
  relativePath: string;
  patchCount: number;
}

export function loadBaselineHtml(): string {
  if (!fs.existsSync(BASELINE_HTML_PATH)) {
    throw new Error(`Missing ${BASELINE_HTML_PATH}. Run npm run prepare:baseline first.`);
  }
  return fs.readFileSync(BASELINE_HTML_PATH, "utf8");
}

/** Unpatched lab baseline — always patch variants from this, not from index.html. */
export function loadSourceBaselineHtml(): string {
  if (fs.existsSync(LAB_SOURCE_HTML_PATH)) {
    return fs.readFileSync(LAB_SOURCE_HTML_PATH, "utf8");
  }
  return loadBaselineHtml();
}

export function writeVariantHtml(
  variant: PageVariant,
  baselineHtml: string,
  baselineVariant: PageVariant = GENERATION_0[0]
): HtmlWriteResult {
  fs.mkdirSync(VARIANTS_DIR, { recursive: true });
  const normalized = normalizeVariantForReplica(variant);
  const patchCount = buildVariantHtmlReplacements(baselineVariant, normalized, baselineHtml).length;

  if (variant.id === baselineVariant.id) {
    return {
      variantId: variant.id,
      relativePath: "public/baseline/index.html",
      patchCount: 0,
    };
  }

  const html = replicaHtmlWithGuard(baselineHtml, normalized);
  const outPath = path.join(VARIANTS_DIR, `${variant.id}.html`);
  fs.writeFileSync(outPath, html, "utf8");

  return {
    variantId: variant.id,
    relativePath: path.relative(ROOT, outPath),
    patchCount,
  };
}

/** Write merged production copy to baseline index.html (live control arm). */
export function writeProductionBaseline(
  mergedBaseline: PageVariant,
  baselineHtml: string,
  baselineVariant: PageVariant = GENERATION_0[0]
): HtmlWriteResult {
  const normalized = normalizeVariantForReplica({
    ...mergedBaseline,
    id: `${mergedBaseline.id}-production`,
  });
  const patchCount = buildVariantHtmlReplacements(baselineVariant, normalized, baselineHtml).length;
  const html = replicaHtmlWithGuard(baselineHtml, normalized);
  fs.writeFileSync(BASELINE_HTML_PATH, html, "utf8");

  const productionPath = path.join(VARIANTS_DIR, "production.html");
  fs.mkdirSync(VARIANTS_DIR, { recursive: true });
  fs.writeFileSync(productionPath, html, "utf8");

  return {
    variantId: "production",
    relativePath: path.relative(ROOT, BASELINE_HTML_PATH),
    patchCount,
  };
}

/** Unpatched lab baseline copy for previews — separate from production index.html. */
export function writeLabBaselineVariantHtml(): HtmlWriteResult {
  fs.mkdirSync(VARIANTS_DIR, { recursive: true });
  const baselineHtml = loadSourceBaselineHtml();
  const outPath = path.join(VARIANTS_DIR, `${GENERATION_0[0].id}.html`);
  fs.writeFileSync(outPath, baselineHtml, "utf8");
  return {
    variantId: GENERATION_0[0].id,
    relativePath: path.relative(ROOT, outPath),
    patchCount: 0,
  };
}

/** Regenerate static HTML for every variant in the run plus gen-0 challengers. */
export function writeAllVariantHtml(
  variants: PageVariant[],
  opts?: { includeLabBaseline?: boolean }
): HtmlWriteResult[] {
  const baselineHtml = loadSourceBaselineHtml();
  const baselineVariant = GENERATION_0[0];
  const ids = new Set<string>();
  const toWrite = [...GENERATION_0, ...variants.filter((v) => v.generation > 0)];

  const results: HtmlWriteResult[] = [];
  if (opts?.includeLabBaseline) {
    results.push(writeLabBaselineVariantHtml());
    ids.add(baselineVariant.id);
  }

  for (const variant of toWrite) {
    if (ids.has(variant.id) || variant.id === baselineVariant.id) continue;
    ids.add(variant.id);
    results.push(writeVariantHtml(variant, baselineHtml, baselineVariant));
  }
  return results;
}
