"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExperimentRun, GenerationRun } from "@/shared/schema/experiment";
import type { VisitIndex } from "@/shared/registry";
import type { PageVariant } from "@/shared/schema/page";
import type { ExperimentProgress } from "@/shared/schema/experiment-progress";
import type { ExperimentHistoryEntry } from "@/lab/live-loop/state";
import { comparisonSnapshotsForIteration, experimentNumbersFromHistory } from "@/lab/comparison/snapshots";
import { isProgressActivelyRunning } from "@/lab/live-loop/experiment-progress-utils";
import { buildJudgmentsFromMetrics } from "@/lab/judgment/criteria";

export interface RunPayload {
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

export function runFromPayload(data: RunPayload): ExperimentRun | null {
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

export function useWorkbenchData({
  initialRun,
  initialDeployVersion,
  initialIndex,
}: {
  initialRun: ExperimentRun | null;
  initialDeployVersion: number;
  initialIndex: VisitIndex | null;
}) {
  const [iterationRun, setIterationRun] = useState<ExperimentRun | null>(initialRun);
  const [visitIndex, setVisitIndex] = useState<VisitIndex | null>(initialIndex);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [deployVersion, setDeployVersion] = useState(initialDeployVersion);
  const [experimentHistory, setExperimentHistory] = useState<ExperimentHistoryEntry[]>([]);
  const [progress, setProgress] = useState<ExperimentProgress | null>(null);
  const [iteration, setIteration] = useState(1);
  const [experimentMode, setExperimentMode] = useState<"hybrid" | "full">("hybrid");

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
    (settings: { autonomous: boolean; experimentMode: "hybrid" | "full" }) => {
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
    const intervalMs = isRunning ? 5_000 : 15_000;
    const t = setInterval(pollProgress, intervalMs);
    return () => clearInterval(t);
  }, [pollProgress, isRunning]);

  const prevProgressStatus = useRef<ExperimentProgress["status"] | null>(null);
  useEffect(() => {
    const prev = prevProgressStatus.current;
    prevProgressStatus.current = progress?.status ?? null;

    if (progress?.status !== "complete" || prev === "complete") return;
    const completed = progress.experimentNumber ?? iteration;
    void loadIteration(completed);
    void pollCatalogLite();
  }, [progress?.status, progress?.experimentNumber, iteration, loadIteration, pollCatalogLite]);

  useEffect(() => {
    if (!isRunning) return;
    void pollCatalogLite();
    const t = setInterval(pollCatalogLite, 5_000);
    return () => clearInterval(t);
  }, [isRunning, pollCatalogLite]);

  useEffect(() => {
    if (!isRunning || iteration !== maxIteration) return;
    void loadIteration(iteration, { lite: true });
    const t = setInterval(() => loadIteration(iteration, { lite: true }), 10_000);
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

  const progressExperiment = progress?.experimentNumber ?? maxIteration;

  return {
    iterationRun,
    visitIndex,
    selectedVariantId,
    setSelectedVariantId,
    deployVersion,
    experimentHistory,
    progress,
    iteration,
    experimentMode,
    isRunning,
    experimentOptions,
    partialExperimentNumbers,
    maxIteration,
    showProgressBar,
    dismissProgress,
    pollProgress,
    handleSettingsChange,
    goToExperiment,
    goToLatestExperiment,
    judgmentsByVariant,
    iterationVariants,
    previousVariants,
    currentVariants,
    progressExperiment,
  };
}
