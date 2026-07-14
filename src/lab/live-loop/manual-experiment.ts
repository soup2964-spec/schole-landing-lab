import { runExperiment, llmExperimentConfig } from "@/lab/evolution/run";
import { GENERATION_0 } from "@/config/variants";
import { promoteAndDeploy, type PromoteResult } from "@/lab/deploy/promote";
import { writeAllVariantHtml } from "@/lab/deploy/write-html";
import { isLlmConfigured, llmProvider } from "@/shared/llm";
import { invalidateRunCache, saveRun } from "@/shared/registry";
import type { ExperimentMode } from "@/shared/schema/experiment-progress";
import {
  ExperimentProgressReporter,
  clearExperimentProgress,
  loadExperimentProgress,
} from "./experiment-progress";
import { isProgressActivelyRunning } from "./experiment-progress-utils";
import { saveExperimentRun } from "@/lab/experiments/store";
import { sortBredVariants } from "@/lab/comparison/snapshots";
import { invalidateLoopCache, loadLoopState, nextExperimentNumber, normalizeExperimentHistory, saveLoopState } from "./state";

export type { ExperimentMode };

export interface ManualExperimentResult {
  runId: string;
  runVersion: number;
  experimentNumber: number;
  totalVisits: number;
  offspringCount: number;
  offspringIds: string[];
  experimentMode: ExperimentMode;
  llmProvider: string | null;
  deploy: PromoteResult;
}

/** Experiments always use heuristic persona readings + LLM breeding. */
export function manualExperimentMode(): ExperimentMode {
  return "hybrid";
}

export async function runManualExperiment(): Promise<ManualExperimentResult> {
  const loopState = await loadLoopState();
  const mode = manualExperimentMode();

  if (!isLlmConfigured()) {
    throw new Error(
      "LLM API key required — add KIE_API_KEY or OPENAI_API_KEY to .env.local (optimizer uses LLM)"
    );
  }

  const existing = await loadExperimentProgress();
  if (isProgressActivelyRunning(existing)) {
    throw new Error("An experiment is already running — wait for it to finish or dismiss the progress bar.");
  }

  const history = normalizeExperimentHistory(loopState.experimentHistory);
  const experimentNumber = nextExperimentNumber(history);
  const previousPool =
    experimentNumber === 1
      ? undefined
      : sortBredVariants(
          history.find((e) => e.experimentNumber === experimentNumber - 1)?.currentVariants ?? []
        );

  const seed = Date.now() % 1_000_000_000;
  const runId = `run-${seed}`;
  const generations = Number(process.env.LLM_GENERATIONS ?? 2);
  await clearExperimentProgress();
  const progress = new ExperimentProgressReporter(mode, generations, experimentNumber, runId);

  try {
    const run = await runExperiment({
      ...llmExperimentConfig(seed, (msg) => console.log(`[experiment] ${msg}`)),
      generations,
      initialPool: previousPool?.length ? previousPool : undefined,
      progress,
    });

    progress.saving("Saving results and writing page previews…");
    await saveRun(run);
    await saveExperimentRun(experimentNumber, run);
    invalidateRunCache();
    writeAllVariantHtml(run.variants, { includeLabBaseline: true });

    const offspringIds =
      [...run.generations].reverse().find((g) => g.offspringIds?.length)?.offspringIds ?? [];
    const totalVisits = run.generations.reduce(
      (sum, g) => sum + (g.totalVisits ?? g.visits.length),
      0
    );

    const loopStateAfter = await loadLoopState();
    const historyAfter = normalizeExperimentHistory(loopStateAfter.experimentHistory);
    const previousVariants =
      experimentNumber === 1
        ? [...GENERATION_0]
        : [
            ...(historyAfter.find((e) => e.experimentNumber === experimentNumber - 1)
              ?.currentVariants ?? GENERATION_0),
          ];
    const currentVariants = sortBredVariants(
      offspringIds
        .map((id) => run.variants.find((v) => v.id === id))
        .filter((v): v is NonNullable<typeof v> => Boolean(v))
    );

    const next = {
      ...loopStateAfter,
      llmPersonas: false,
      lastSyncAt: new Date().toISOString(),
      lastRunId: run.id,
      syncHistory: [
        {
          at: new Date().toISOString(),
          visitors: 0,
          reason: "manual-hybrid-experiment",
        },
        ...loopStateAfter.syncHistory.slice(0, 19),
      ],
      experimentHistory: normalizeExperimentHistory([
        ...historyAfter.filter((e) => e.experimentNumber !== experimentNumber),
        {
          experimentNumber,
          runId: run.id,
          previousVariants,
          currentVariants,
        },
      ]),
    };
    await saveLoopState(next);
    invalidateLoopCache();

    const deploy =
      process.env.AUTO_DEPLOY_BEST === "1"
        ? await promoteAndDeploy(run, { forceBest: true })
        : {
            promoted: false,
            reason: "Lab mode — baseline preserved (set AUTO_DEPLOY_BEST=1 to auto-promote)",
            htmlWritten: run.variants.length,
          };

    progress.complete();

    return {
      runId: run.id,
      runVersion: loopStateAfter.runVersion,
      experimentNumber,
      totalVisits,
      offspringCount: offspringIds.length,
      offspringIds,
      experimentMode: mode,
      llmProvider: llmProvider(),
      deploy,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Experiment failed";
    progress.fail(message);
    throw err;
  }
}

export function isLlmExperimentAvailable(): boolean {
  return isLlmConfigured();
}

export function llmExperimentProviderLabel(): string | null {
  return isLlmConfigured() ? llmProvider() : null;
}
