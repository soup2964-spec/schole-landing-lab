import type { ExperimentRun } from "@/lib/schema/experiment";
import type { ExperimentProgress } from "@/lib/schema/experiment-progress";
import { compactRunForStorage } from "@/lib/evolve/compact-run";
import { loadRun } from "@/lib/registry";
import {
  getLabDocument,
  LAB_DOC,
  listExperimentNumbers,
  setLabDocument,
} from "@/lib/supabase/lab-documents";
import { normalizeExperimentHistory, type ExperimentHistoryEntry } from "@/lib/loop/state";
import {
  bredVariantsFromRun,
  originalGen0Variants,
} from "@/lib/comparison/snapshots";

export async function saveExperimentRun(experimentNumber: number, run: ExperimentRun) {
  await setLabDocument(LAB_DOC.experiment(experimentNumber), compactRunForStorage(run));
}

export async function loadExperimentRun(experimentNumber: number): Promise<ExperimentRun | null> {
  return getLabDocument<ExperimentRun>(LAB_DOC.experiment(experimentNumber));
}

function entryFromRun(
  experimentNumber: number,
  run: ExperimentRun,
  previousVariants: ExperimentHistoryEntry["previousVariants"]
): ExperimentHistoryEntry {
  return {
    experimentNumber,
    runId: run.id,
    previousVariants,
    currentVariants: bredVariantsFromRun(run),
  };
}

function chainPreviousVariants(entries: ExperimentHistoryEntry[]): ExperimentHistoryEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    previousVariants:
      index === 0 ? originalGen0Variants() : (entries[index - 1]?.currentVariants ?? []),
  }));
}

async function entriesFromExperimentNumbers(
  numbers: number[]
): Promise<ExperimentHistoryEntry[]> {
  if (!numbers.length) return [];
  const runs = await Promise.all(numbers.map((n) => loadExperimentRun(n)));
  const entries = runs.flatMap((run, index) =>
    run ? [entryFromRun(numbers[index]!, run, [])] : []
  );
  return chainPreviousVariants(normalizeExperimentHistory(entries));
}

/** Rebuild history entries from saved experiment:N snapshots. */
async function historyFromSnapshots(): Promise<ExperimentHistoryEntry[]> {
  return entriesFromExperimentNumbers(await listExperimentNumbers());
}

/** Load only snapshots missing from loop_state (one id-list query + parallel reads). */
async function historyFromSnapshotGaps(
  loopHistory: ExperimentHistoryEntry[]
): Promise<ExperimentHistoryEntry[]> {
  const known = new Set(loopHistory.map((entry) => entry.experimentNumber));
  const missing = (await listExperimentNumbers()).filter((n) => !known.has(n));
  return entriesFromExperimentNumbers(missing);
}

/** Append active_run when it is a newer run than the last catalog entry. */
async function appendActiveRunIfNewer(
  entries: ExperimentHistoryEntry[]
): Promise<ExperimentHistoryEntry[]> {
  const activeRun = await loadRun();
  if (!activeRun) return entries;

  const last = entries[entries.length - 1];
  if (last?.runId === activeRun.id) return entries;

  if (!last) {
    return chainPreviousVariants(
      normalizeExperimentHistory([entryFromRun(1, activeRun, originalGen0Variants())])
    );
  }

  return chainPreviousVariants(
    normalizeExperimentHistory([
      ...entries,
      entryFromRun(last.experimentNumber + 1, activeRun, last.currentVariants),
    ])
  );
}

function mergeHistoryEntries(
  ...sources: ExperimentHistoryEntry[][]
): ExperimentHistoryEntry[] {
  const byNumber = new Map<number, ExperimentHistoryEntry>();
  for (const source of sources) {
    for (const entry of source) {
      byNumber.set(entry.experimentNumber, entry);
    }
  }
  const merged = [...byNumber.values()].sort((a, b) => a.experimentNumber - b.experimentNumber);
  return chainPreviousVariants(normalizeExperimentHistory(merged));
}

/**
 * Full experiment list for the left-menu navigator: loop history, snapshots,
 * and active_run when it represents a newer run than the last saved experiment.
 */
export async function buildExperimentCatalog(
  loopHistory: ExperimentHistoryEntry[] = [],
  options: { reconcileSnapshots?: boolean } = {}
): Promise<ExperimentHistoryEntry[]> {
  const fromLoop = normalizeExperimentHistory(loopHistory);

  let fromSnapshots: ExperimentHistoryEntry[] = [];
  // Only reconcile snapshot gaps when loop history already has entries.
  // An empty loop history means a fresh lab — do not resurrect experiment:N snapshots.
  if (fromLoop.length > 0 && options.reconcileSnapshots) {
    fromSnapshots = await historyFromSnapshotGaps(fromLoop);
  }

  const merged = mergeHistoryEntries(fromSnapshots, fromLoop);
  return appendActiveRunIfNewer(merged);
}

/** Fast path for polling — uses loop_state history plus active_run when newer. */
export async function buildExperimentCatalogLite(
  loopHistory: ExperimentHistoryEntry[] = []
): Promise<ExperimentHistoryEntry[]> {
  return appendActiveRunIfNewer(normalizeExperimentHistory(loopHistory));
}

export async function ensureExperimentSnapshots(history: ExperimentHistoryEntry[] = []) {
  const normalized = normalizeExperimentHistory(history);
  const activeRun = await loadRun();
  if (!activeRun) return normalized;

  const toBackfill = normalized.filter(
    (entry) => entry.runId === activeRun.id
  );
  if (!toBackfill.length) return normalized;

  const existing = await Promise.all(
    toBackfill.map((entry) => loadExperimentRun(entry.experimentNumber))
  );
  await Promise.all(
    toBackfill.flatMap((entry, index) =>
      existing[index] ? [] : [saveExperimentRun(entry.experimentNumber, activeRun)]
    )
  );

  return normalized;
}

export async function loadRunForExperiment(
  experimentNumber: number,
  history: ExperimentHistoryEntry[] = [],
  progress: ExperimentProgress | null = null,
  options: { catalog?: ExperimentHistoryEntry[]; skipSnapshotSync?: boolean } = {}
): Promise<ExperimentRun | null> {
  const catalog =
    options.catalog ??
    (options.skipSnapshotSync
      ? await buildExperimentCatalogLite(history)
      : await buildExperimentCatalog(history));

  if (!options.skipSnapshotSync) {
    await ensureExperimentSnapshots(catalog);
  }

  const saved = await loadExperimentRun(experimentNumber);
  if (saved) return saved;

  const entry = catalog.find((e) => e.experimentNumber === experimentNumber);
  if (entry) {
    const activeRun = await loadRun();
    if (activeRun?.id === entry.runId) return activeRun;
  }

  if (
    progress?.status === "running" &&
    progress.experimentNumber === experimentNumber
  ) {
    const activeRun = await loadRun();
    if (activeRun && progress.startedAt && activeRun.createdAt >= progress.startedAt) {
      return activeRun;
    }
  }

  return null;
}
