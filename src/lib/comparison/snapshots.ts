import type { ExperimentRun } from "@/lib/schema/experiment";
import type { PageVariant } from "@/lib/schema/page";
import type { ExperimentProgress } from "@/lib/schema/experiment-progress";
import type { ExperimentHistoryEntry } from "@/lib/loop/state";

export const BRED_GRID_SIZE = 6;

export function sortGen0Variants(variants: PageVariant[]): PageVariant[] {
  return [...variants]
    .filter((v) => v.generation === 0)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, BRED_GRID_SIZE);
}

export function sortBredVariants(variants: PageVariant[]): PageVariant[] {
  return [...variants]
    .filter((v) => v.generation > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, BRED_GRID_SIZE);
}

export function bredVariantsFromRun(run: ExperimentRun | null): PageVariant[] {
  if (!run) return [];
  const byId = new Map(run.variants.map((v) => [v.id, v]));
  for (let i = run.generations.length - 1; i >= 0; i--) {
    const ids = run.generations[i].offspringIds ?? [];
    if (ids.length) {
      return sortBredVariants(
        ids.map((id) => byId.get(id)).filter((v): v is PageVariant => Boolean(v))
      );
    }
  }
  return sortBredVariants(run.variants);
}

export function comparisonSnapshotsForIteration(
  iteration: number,
  opts: {
    gen0Variants: PageVariant[];
    run: ExperimentRun | null;
    runVersion: number;
    experimentHistory: ExperimentHistoryEntry[];
    progress: ExperimentProgress | null;
  }
): { previous: PageVariant[]; current: PageVariant[] } {
  const { gen0Variants, run, runVersion, experimentHistory, progress } = opts;
  const historyEntry = experimentHistory.find((e) => e.experimentNumber === iteration);
  if (historyEntry) {
    return {
      previous: sortGen0Variants(historyEntry.previousVariants),
      current: sortBredVariants(historyEntry.currentVariants),
    };
  }

  const isRunning = progress?.status === "running";
  const activeExperiment = runVersion + (isRunning ? 1 : 0);

  if (iteration === activeExperiment && isRunning) {
    return {
      previous:
        iteration === 1
          ? sortGen0Variants(gen0Variants)
          : sortBredVariants(
              experimentHistory.find((e) => e.experimentNumber === iteration - 1)
                ?.currentVariants ?? []
            ),
      current: sortBredVariants(progress?.bredVariants ?? []),
    };
  }

  if (iteration === runVersion && runVersion > 0) {
    const previous =
      iteration === 1
        ? sortGen0Variants(gen0Variants)
        : sortBredVariants(
            experimentHistory.find((e) => e.experimentNumber === iteration - 1)
              ?.currentVariants ?? []
          );
    return { previous, current: bredVariantsFromRun(run) };
  }

  if (iteration === 1) {
    return { previous: sortGen0Variants(gen0Variants), current: [] };
  }

  return { previous: sortGen0Variants(gen0Variants), current: [] };
}
