"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExperimentRun, GenerationRun } from "@/lib/schema/experiment";
import type { VisitIndex } from "@/lib/registry";
import type { PageVariant } from "@/lib/schema/page";
import type { ExperimentProgress } from "@/lib/schema/experiment-progress";
import type { ExperimentHistoryEntry } from "@/lib/loop/state";
import { CRITERIA } from "@/config/criteria";
import { buildJudgmentsFromMetrics } from "@/lib/judgment/criteria";
import { comparisonSnapshotsForIteration, sortGen0Variants } from "@/lib/comparison/snapshots";
import { ControlCenterView } from "@/components/experiment/ControlCenterView";
import { ExperimentDetailPanel } from "@/components/experiment/ExperimentDetailPanel";
import { PageComparisonView } from "@/components/experiment/PageComparisonView";
import {
  ExperimentSideMenu,
  type WorkbenchView,
} from "@/components/experiment/ExperimentSideMenu";

interface RunPayload {
  runVersion: number;
  experimentHistory?: ExperimentHistoryEntry[];
  experimentProgress?: ExperimentProgress;
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

function runFromPayload(
  initial: ExperimentRun | null,
  data: RunPayload
): ExperimentRun | null {
  if (!data.generations?.length) return initial;
  return {
    id: initial?.id ?? "live",
    createdAt: initial?.createdAt ?? new Date().toISOString(),
    personaSetVersion: initial?.personaSetVersion ?? 1,
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
  const [run, setRun] = useState(initialRun);
  const [variants, setVariants] = useState(initialVariants);
  const [visitIndex, setVisitIndex] = useState(initialIndex);
  const [activeView, setActiveView] = useState<WorkbenchView>("control");
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [comparisonVariantId, setComparisonVariantId] = useState<string | null>(null);
  const [deployVersion, setDeployVersion] = useState(initialDeployVersion);
  const [runVersion, setRunVersion] = useState(0);
  const [experimentHistory, setExperimentHistory] = useState<ExperimentHistoryEntry[]>([]);
  const [progress, setProgress] = useState<ExperimentProgress | null>(null);
  const [iteration, setIteration] = useState(1);

  const isRunning = progress?.status === "running";
  const maxIteration = Math.max(
    1,
    runVersion,
    experimentHistory.length,
    isRunning ? runVersion + 1 : 0
  );

  const refresh = useCallback(async (): Promise<RunPayload | null> => {
    try {
      const res = await fetch("/api/run");
      if (!res.ok) return null;
      const data = (await res.json()) as RunPayload;
      setVariants(data.variants);
      setVisitIndex(data.index);
      setRunVersion(data.runVersion ?? 0);
      setExperimentHistory(data.experimentHistory ?? []);
      if (data.experimentProgress) setProgress(data.experimentProgress);
      const nextDeploy = data.deployVersion ?? data.deploy?.deployVersion ?? 0;
      setDeployVersion(nextDeploy);
      setRun((prev) => runFromPayload(prev, data));
      setIteration((i) => Math.min(Math.max(1, i), Math.max(1, data.runVersion ?? 1)));
      return data;
    } catch {
      return null;
    }
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const ms = isRunning ? 800 : 5000;
    void pollProgress();
    const t = setInterval(pollProgress, ms);
    return () => clearInterval(t);
  }, [isRunning, pollProgress]);

  useEffect(() => {
    setIteration((i) => Math.min(Math.max(1, i), maxIteration));
  }, [maxIteration]);

  const handleSelectVariant = (variantId: string) => {
    setSelectedVariantId(variantId);
    setActiveView("behavior");
  };

  const gen0Variants = useMemo(() => sortGen0Variants(variants), [variants]);

  const judgmentsByVariant = useMemo(() => {
    const lastGen = run?.generations[run.generations.length - 1];
    if (!lastGen?.metrics) return {};
    return buildJudgmentsFromMetrics(lastGen.metrics, lastGen.decisions);
  }, [run]);

  const { previous: previousVariants, current: currentVariants } = useMemo(
    () =>
      comparisonSnapshotsForIteration(iteration, {
        gen0Variants,
        run,
        runVersion,
        experimentHistory,
        progress,
      }),
    [iteration, gen0Variants, run, runVersion, experimentHistory, progress]
  );

  const comparisonMeta = CRITERIA.find((c) => c.id === "1");

  return (
    <div className="flex min-h-[calc(100vh-65px)] bg-slate-100">
      <ExperimentSideMenu
        activeView={activeView}
        onViewChange={setActiveView}
        iteration={iteration}
        maxIteration={maxIteration}
        onPrevIteration={() => setIteration((i) => Math.max(1, i - 1))}
        onNextIteration={() => setIteration((i) => Math.min(maxIteration, i + 1))}
      />

      <div className="min-w-0 flex-1 overflow-y-auto lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)]">
        {activeView === "control" ? (
          <ControlCenterView
            onExperimentComplete={async () => {
              const data = await refresh();
              await pollProgress();
              const rv = data?.runVersion ?? 0;
              const histLen = data?.experimentHistory?.length ?? 0;
              setIteration(Math.max(rv, histLen, 1));
              setActiveView("versions");
            }}
          />
        ) : activeView === "versions" ? (
          <div className="p-6">
            {comparisonMeta && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900">{comparisonMeta.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{comparisonMeta.question}</p>
              </div>
            )}
            <PageComparisonView
              experimentNumber={iteration}
              previousVariants={previousVariants}
              currentVariants={currentVariants}
              judgmentsByVariant={judgmentsByVariant}
              selectedVariantId={comparisonVariantId}
              onSelectVariant={setComparisonVariantId}
              onViewBehavior={handleSelectVariant}
              isRunning={isRunning && iteration === runVersion + 1}
            />
          </div>
        ) : (
          <div className="bg-white">
            <ExperimentDetailPanel
              activeView={activeView}
              run={run}
              variants={variants}
              visitIndex={visitIndex}
              selectedVariantId={selectedVariantId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
