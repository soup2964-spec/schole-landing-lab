import type { PageVariant } from "@/shared/schema/page";
import type { Visit } from "@/shared/schema/events";
import type { GenerationReport } from "@/shared/schema/experiment";
import type { VariantMetrics } from "@/shared/schema/events";
import { mapPool } from "@/shared/async/pool";
import { breedVariant, pageSimilarity, angleForChild, BREEDING_ANGLES } from "./optimizer";
import type { BreedingAngle } from "./optimizer";
import type { ExperimentProgressReporter } from "@/lab/live-loop/experiment-progress";
import { writeVariantHtml } from "@/lab/deploy/write-html";

function heroHeadline(variant: PageVariant): string {
  return variant.sections.find((s) => s.type === "hero" || s.id === "hero")?.headline ?? "";
}

function crossoverParents(top: PageVariant[], index: number): PageVariant[] {
  if (top.length < 2) return top;
  const pairs: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 2],
    [2, 1],
    [1, 0],
    [2, 0],
  ];
  const [a, b] = pairs[index % pairs.length];
  return [top[a] ?? top[0], top[b] ?? top[1]].filter(
    (p, i, arr) => p && arr.indexOf(p) === i
  );
}

function textWordSet(text: string): Set<string> {
  return new Set(
    (text ?? "")
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const inter = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
}

/**
 * A candidate is a duplicate of a sibling if it shares a hero headline, is too
 * similar on section copy, or makes the same strategic bet (thesis overlap).
 * Compared against SIBLINGS only — offspring are intentionally anchored to base
 * angles, so resembling a base parent is expected, not a collision.
 */
function isDuplicateOffspring(candidate: PageVariant, siblings: PageVariant[]): boolean {
  const hero = heroHeadline(candidate);
  const candThesis = textWordSet(candidate.thesis ?? "");
  return siblings.some((v) => {
    if (hero && heroHeadline(v) === hero) return true;
    if (pageSimilarity(candidate, v) > 0.5) return true;
    if (jaccard(candThesis, textWordSet(v.thesis ?? "")) > 0.6) return true;
    return false;
  });
}

/** Sample a few verbatim converted/lost verdicts per parent to ground the copy. */
function sampleVerdictBlock(visits: Visit[], parents: PageVariant[]): string {
  const lines: string[] = [];
  for (const p of parents) {
    const vs = visits.filter((x) => x.variantId === p.id);
    const converted = vs.filter((x) => x.converted).slice(0, 2);
    const lost = vs.filter((x) => !x.converted).slice(0, 3);
    for (const x of [...converted, ...lost]) {
      lines.push(
        `  [${p.id} · ${x.personaId} · ${x.converted ? "CONVERTED" : "LOST"}] "${x.verdict}"`
      );
    }
  }
  return lines.join("\n");
}

async function breedDistinctOffspring(
  childIndex: number,
  top: PageVariant[],
  metrics: VariantMetrics[],
  report: GenerationReport,
  generation: number,
  siblings: PageVariant[],
  angle: BreedingAngle,
  verdictBlock: string,
  log: (msg: string) => void
): Promise<PageVariant> {
  const attempts: { mode: "mutation" | "crossover"; parents: PageVariant[] }[] = [
    {
      mode: childIndex % 2 === 0 ? "mutation" : "crossover",
      parents:
        childIndex % 2 === 0
          ? [top[childIndex % top.length] ?? top[0]]
          : crossoverParents(top, childIndex),
    },
    { mode: "mutation", parents: [top[(childIndex + 1) % top.length] ?? top[0]] },
    { mode: "crossover", parents: crossoverParents(top, childIndex + 2) },
    { mode: "mutation", parents: [top[(childIndex + 2) % top.length] ?? top[0]] },
  ];

  let last: PageVariant | null = null;
  for (let attempt = 0; attempt < attempts.length; attempt++) {
    const { mode, parents } = attempts[attempt];
    log(`  breeding ${angle.name} (child ${childIndex}, ${mode})${attempt ? ` retry ${attempt}` : ""}...`);
    const child = await breedVariant(
      mode,
      parents,
      metrics,
      report,
      generation,
      childIndex,
      angle,
      verdictBlock
    );
    last = child;
    if (!isDuplicateOffspring(child, siblings)) return child;
    log(`    ${angle.name} too similar to a sibling; retrying...`);
  }
  return last!;
}

function breedConcurrency(): number {
  return Number(process.env.LLM_BREED_CONCURRENCY ?? 6);
}

/**
 * Breed all offspring with bounded parallel KIE calls. Each child is pinned to a
 * distinct base-preview angle so the batch explores different bets; duplicates
 * (same hero/thesis as an already-accepted sibling) are retried sequentially.
 */
export async function breedAllOffspring(
  count: number,
  top: PageVariant[],
  metrics: VariantMetrics[],
  report: GenerationReport,
  generation: number,
  visits: Visit[],
  baselineHtml: string,
  baselineVariant: PageVariant,
  log: (msg: string) => void,
  progress?: ExperimentProgressReporter
): Promise<PageVariant[]> {
  const parallel = Math.max(1, Math.min(breedConcurrency(), count));
  const verdictBlock = sampleVerdictBlock(visits, top);
  const angleCount = Math.min(count, BREEDING_ANGLES.length);

  log(`  breeding ${count} offspring across ${angleCount} angles (${parallel} parallel KIE calls)...`);
  progress?.breedingStart(count);

  const offspring: PageVariant[] = [];
  // Serialize accept + persist so previews land as each KIE call returns.
  let acceptChain = Promise.resolve();

  await mapPool(
    Array.from({ length: count }, (_, i) => i),
    parallel,
    async (childIndex) => {
      const angle = angleForChild(childIndex);
      const child = await breedDistinctOffspring(
        childIndex,
        top,
        metrics,
        report,
        generation,
        [],
        angle,
        verdictBlock,
        log
      );
      log(`  ${angle.name} LLM returned (child ${childIndex})`);

      await new Promise<void>((resolve, reject) => {
        acceptChain = acceptChain.then(async () => {
          try {
            let accepted = child;
            if (isDuplicateOffspring(accepted, offspring)) {
              log(`  ${angle.name} duplicate; retrying against siblings...`);
              accepted = await breedDistinctOffspring(
                childIndex,
                top,
                metrics,
                report,
                generation,
                offspring,
                angle,
                verdictBlock,
                log
              );
            }
            offspring.push(accepted);
            progress?.breedingProgress(offspring.length, count);
            progress?.addBredVariant(accepted);
            writeVariantHtml(accepted, baselineHtml, baselineVariant);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    }
  );

  await acceptChain;
  return offspring;
}

