"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExperimentRun, GenerationRun } from "@/lib/schema/experiment";
import type { VisitIndex } from "@/lib/registry";
import type { PageVariant } from "@/lib/schema/page";
import type { ExperimentProgress } from "@/lib/schema/experiment-progress";
import type { ExperimentHistoryEntry } from "@/lib/loop/state";
import { CRITERIA } from "@/config/criteria";
import { buildJudgmentsFromMetrics } from "@/lib/judgment/criteria";
import { comparisonSnapshotsForIteration, experimentNumbersFromHistory } from "@/lib/comparison/snapshots";
import { isProgressActivelyRunning } from "@/lib/loop/experiment-progress-utils";
import { ControlCenterView } from "@/components/experiment/ControlCenterView";
import { ExperimentDetailPanel } from "@/components/experiment/ExperimentDetailPanel";
import { ExperimentProgressBar } from "@/components/experiment/ExperimentProgressBar";
import { PageComparisonView } from "@/components/experiment/PageComparisonView";
import {
  ExperimentSideMenu,
  type WorkbenchView,
} from "@/components/experiment/ExperimentSideMenu";

interface RunPayload {
  runId?: string | null;
  runVersion: number;
  updatedAt?: string;
  personaSetVersion?: number;
  experimentHistory?: ExperimentHistoryEntry[];
  experimentProgress?: ExperimentProgress;
  experimentNumber?: number | null;
  deployVersion?: number;
  lastPromotedVariantId?: string | null;
  deploy?: {
    deployVersion: number;
    lastPromotedVariantId: string | null;
    history?: { reason: string }[];
  };
  comparison?: {
    previous: PageVariant[];
    current: PageVariant[];
    deployVersion: number;
    lastPromotedVariantId: string | null;
  };
  variants: PageVariant[];
  index: VisitIndex;
  generations?: Array<
    Pick<
      GenerationRun,
      | "generation"
      | "variantIds"
      | "totalVisits"
      | "metrics"
      | "decisions"
      | "allocationHistory"
      | "offspringIds"
    > & { report: { insights: string } }
  >;
}

function runFromPayload(data: RunPayload): ExperimentRun | null {
  if (!data.generations?.length) return null;
  return {
    id: data.runId ?? "live",
    createdAt: data.updatedAt ?? new Date().toISOString(),
    personaSetVersion: data.personaSetVersion ?? 1,
    variants: data.variants,
    generations: data.generations.map((g) => ({
      ...g,
      visits: [],
      offspringIds: g.offspringIds ?? [],
      report: {
        generation: g.generation,
        insights: g.report.insights,
        findings: [],
        scorecards: [],
      },
    })),
  };
}

export function ExperimentWorkbench({
  initialRun,
  initialVariants,
  initialDeployVersion,
  initialIndex,
}: {
  initialRun: ExperimentRun | null;
  initialVariants: PageVariant[];
  initialDeployVersion: number;
  initialIndex: VisitIndex | null;
}) {
  const [iterationRun, setIterationRun] = useState<ExperimentRun | null>(initialRun);
  const [visitIndex, setVisitIndex] = useState<VisitIndex | null>(initialIndex);
  const [activeView, setActiveView] = useState<WorkbenchView>("control");
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [deployVersion, setDeployVersion] = useState(initialDeployVersion);
  const [experimentHistory, setExperimentHistory] = useState<ExperimentHistoryEntry[]>([]);
  const [progress, setProgress] = useState<ExperimentProgress | null>(null);
  const [iteration, setIteration] = useState(1);
  const [experimentMode, setExperimentMode] = useState<"hybrid" | "full">("hybrid");
  const [llmPersonas, setLlmPersonas] = useState(false);

  const isRunning = isProgressActivelyRunning(progress);
  const activeProgressExperiment =
    isRunning || progress?.status === "error" ? progress?.experimentNumber : null;
  const experimentOptions = useMemo(
    () => experimentNumbersFromHistory(experimentHistory, activeProgressExperiment),
    [experimentHistory, activeProgressExperiment]
  );
  const partialExperimentNumbers = useMemo(() => {
    const partial = new Set<number>();
    for (const entry of experimentHistory) {
      if (entry.partial) partial.add(entry.experimentNumber);
    }
    return partial;
  }, [experimentHistory]);
  const maxIteration = experimentOptions[experimentOptions.length - 1] ?? 1;
  const showProgressBar =
    progress != null &&
    progress.status !== "idle" &&
    (isRunning || progress.status === "complete" || progress.status === "error");

  const dismissProgress = useCallback(async () => {
    try {
      await fetch("/api/control/progress", { method: "DELETE" });
    } catch {
      /* ignore */
    }
    setProgress(null);
  }, []);

  const pollProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/control/progress");
      if (!res.ok) return;
      setProgress(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  /** Lite catalog refresh — history/progress only, no full run payloads. */
  const pollCatalogLite = useCallback(async () => {
    try {
      const res = await fetch("/api/run?lite=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as RunPayload;
      setExperimentHistory(data.experimentHistory ?? []);
      if (data.experimentProgress) setProgress(data.experimentProgress);
    } catch {
      /* ignore */
    }
  }, []);

  const loadIteration = useCallback(async (experimentNumber: number, options?: { lite?: boolean }) => {
    try {
      const qs = new URLSearchParams({ experiment: String(experimentNumber) });
      if (options?.lite) qs.set("lite", "1");
      const res = await fetch(`/api/run?${qs}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as RunPayload;
      setExperimentHistory(data.experimentHistory ?? []);
      if (data.experimentProgress) setProgress(data.experimentProgress);
      const nextDeploy = data.deployVersion ?? data.deploy?.deployVersion ?? 0;
      setDeployVersion(nextDeploy);
      if (!options?.lite || data.generations?.length) {
        setIterationRun(runFromPayload(data));
        setVisitIndex(data.index ?? null);
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const handleSettingsChange = useCallback(
    (settings: { autonomous: boolean; llmPersonas: boolean; experimentMode: "hybrid" | "full" }) => {
      setLlmPersonas(settings.llmPersonas);
      setExperimentMode(settings.experimentMode);
    },
    []
  );

  const goToExperiment = useCallback(
    (experimentNumber: number) => {
      if (!experimentOptions.includes(experimentNumber)) return;
      setIteration(experimentNumber);
    },
    [experimentOptions]
  );

  const goToLatestExperiment = useCallback(async () => {
    const res = await fetch("/api/run?lite=1", { cache: "no-store" });
    if (!res.ok) return 1;
    const data = (await res.json()) as RunPayload;
    const hist = data.experimentHistory ?? [];
    setExperimentHistory(hist);
    const options = experimentNumbersFromHistory(hist, null);
    const latest = options[options.length - 1] ?? 1;
    setIteration(latest);
    await loadIteration(latest);
    return latest;
  }, [loadIteration]);

  useEffect(() => {
    if (progress?.status !== "complete" && progress?.status !== "error") return;
    const t = setTimeout(() => {
      void dismissProgress();
    }, 8000);
    return () => clearTimeout(t);
  }, [progress?.status, dismissProgress]);

  useEffect(() => {
    void pollProgress();
    void loadIteration(1);
    void fetch("/api/control")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        handleSettingsChange({
          autonomous: Boolean(data.autonomous),
          llmPersonas: Boolean(data.llmPersonas),
          experimentMode: data.experimentMode ?? "hybrid",
        });
      })
      .catch(() => undefined);
  }, [loadIteration, pollProgress, handleSettingsChange]);

  useEffect(() => {
    void loadIteration(iteration);
    setSelectedVariantId(null);
  }, [iteration, loadIteration]);

  useEffect(() => {
    void pollProgress();
    const t = setInterval(pollProgress, 15_000);
    return () => clearInterval(t);
  }, [pollProgress]);

  useEffect(() => {
    if (!isRunning) return;
    void pollCatalogLite();
    const t = setInterval(pollCatalogLite, 15_000);
    return () => clearInterval(t);
  }, [isRunning, pollCatalogLite]);

  useEffect(() => {
    if (!isRunning || iteration !== maxIteration) return;
    void loadIteration(iteration, { lite: true });
    const t = setInterval(() => loadIteration(iteration, { lite: true }), 30_000);
    return () => clearInterval(t);
  }, [isRunning, iteration, maxIteration, loadIteration]);

  useEffect(() => {
    if (!experimentOptions.includes(iteration)) {
      setIteration(maxIteration);
    }
  }, [experimentOptions, iteration, maxIteration]);

  const judgmentsByVariant = useMemo(() => {
    const lastGen = iterationRun?.generations[iterationRun.generations.length - 1];
    if (!lastGen?.metrics) return {};
    return buildJudgmentsFromMetrics(lastGen.metrics, lastGen.decisions);
  }, [iterationRun]);

  const iterationVariants = iterationRun?.variants ?? [];

  const { previous: previousVariants, current: currentVariants } = useMemo(
    () =>
      comparisonSnapshotsForIteration(iteration, {
        run: iterationRun,
        experimentHistory,
        progress,
      }),
    [iteration, iterationRun, experimentHistory, progress]
  );

  const comparisonMeta = CRITERIA.find((c) => c.id === "1");
  const progressExperiment = progress?.experimentNumber ?? maxIteration;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-slate-100">
      <ExperimentSideMenu
        activeView={activeView}
        onViewChange={setActiveView}
        iteration={iteration}
        experimentOptions={experimentOptions}
        runningExperimentNumber={isRunning ? progress?.experimentNumber : null}
        partialExperimentNumbers={partialExperimentNumbers}
        onPrevIteration={() => {
          const idx = experimentOptions.indexOf(iteration);
          if (idx > 0) goToExperiment(experimentOptions[idx - 1]!);
        }}
        onNextIteration={() => {
          const idx = experimentOptions.indexOf(iteration);
          if (idx >= 0 && idx < experimentOptions.length - 1) {
            goToExperiment(experimentOptions[idx + 1]!);
          }
        }}
        onSelectIteration={goToExperiment}
      />

      <div
        key={`experiment-${iteration}-${iterationRun?.id ?? "none"}`}
        className="min-w-0 flex-1 overflow-y-auto"
      >
        {showProgressBar && progress && (
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 p-4 backdrop-blur">
            <ExperimentProgressBar progress={progress} onDismiss={() => void dismissProgress()} />
            {isRunning && progress.experimentNumber != null && (
              <p className="mt-2 text-center text-xs text-slate-500">
                Experiment {progress.experimentNumber} · progress saved — switch tabs freely
              </p>
            )}
          </div>
        )}

        {activeView === "control" ? (
          <ControlCenterView
            progress={progress}
            pollProgress={pollProgress}
            onDismissProgress={() => void dismissProgress()}
            onSettingsChange={handleSettingsChange}
            onExperimentComplete={async () => {
              await pollProgress();
              await goToLatestExperiment();
              setActiveView("versions");
            }}
          />
        ) : activeView === "versions" ? (
          <div className="p-6">
            {comparisonMeta && (
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-schole-primary">
                  Experiment {iteration}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{comparisonMeta.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{comparisonMeta.question}</p>
              </div>
            )}
            <PageComparisonView
              experimentNumber={iteration}
              previousVariants={previousVariants}
              currentVariants={currentVariants}
              selectedVariantId={selectedVariantId}
              onSelectVariant={setSelectedVariantId}
              isRunning={
                (isRunning || progress?.status === "error") &&
                iteration === progressExperiment
              }
              experimentMode={experimentMode}
              llmPersonas={llmPersonas}
            />
          </div>
        ) : (
          <div className="bg-white">
            <ExperimentDetailPanel
              key={`${iterationRun?.id ?? "none"}-${iteration}`}
              activeView={activeView}
              run={iterationRun}
              variants={iterationVariants}
              visitIndex={visitIndex}
              selectedVariantId={selectedVariantId}
              experimentNumber={iteration}
              bredVariants={currentVariants}
              judgmentsByVariant={judgmentsByVariant}
              experimentMode={experimentMode}
              llmPersonas={llmPersonas}
            />
          </div>
        )}
      </div>
    </div>
  );
}
