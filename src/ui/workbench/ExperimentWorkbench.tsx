"use client";

import { useState } from "react";
import type { ExperimentRun } from "@/shared/schema/experiment";
import type { VisitIndex } from "@/shared/registry";
import type { PageVariant } from "@/shared/schema/page";
import { CRITERIA } from "@/config/criteria";
import { ControlCenterView } from "@/ui/workbench/ControlCenterView";
import { ExperimentDetailPanel } from "@/ui/workbench/ExperimentDetailPanel";
import { ExperimentProgressBar } from "@/ui/workbench/ExperimentProgressBar";
import { PageComparisonView } from "@/ui/workbench/PageComparisonView";
import {
  ExperimentSideMenu,
  type WorkbenchView,
} from "@/ui/workbench/ExperimentSideMenu";
import { useWorkbenchData } from "@/ui/workbench/useWorkbenchData";

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
  void initialVariants;
  const [activeView, setActiveView] = useState<WorkbenchView>("control");
  const data = useWorkbenchData({
    initialRun,
    initialDeployVersion,
    initialIndex,
  });

  const comparisonMeta = CRITERIA.find((c) => c.id === "1");

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-slate-100">
      <ExperimentSideMenu
        activeView={activeView}
        onViewChange={setActiveView}
        iteration={data.iteration}
        experimentOptions={data.experimentOptions}
        runningExperimentNumber={data.isRunning ? data.progress?.experimentNumber : null}
        partialExperimentNumbers={data.partialExperimentNumbers}
        onPrevIteration={() => {
          const idx = data.experimentOptions.indexOf(data.iteration);
          if (idx > 0) data.goToExperiment(data.experimentOptions[idx - 1]!);
        }}
        onNextIteration={() => {
          const idx = data.experimentOptions.indexOf(data.iteration);
          if (idx >= 0 && idx < data.experimentOptions.length - 1) {
            data.goToExperiment(data.experimentOptions[idx + 1]!);
          }
        }}
        onSelectIteration={data.goToExperiment}
      />

      <div
        key={`experiment-${data.iteration}-${data.iterationRun?.id ?? "none"}`}
        className="min-w-0 flex-1 overflow-y-auto"
      >
        {data.showProgressBar && data.progress && (
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 p-4 backdrop-blur">
            <ExperimentProgressBar
              progress={data.progress}
              onDismiss={() => void data.dismissProgress()}
            />
            {data.isRunning && data.progress.experimentNumber != null && (
              <p className="mt-2 text-center text-xs text-slate-500">
                Experiment {data.progress.experimentNumber} · progress saved — switch tabs freely
              </p>
            )}
          </div>
        )}

        {activeView === "control" ? (
          <ControlCenterView
            progress={data.progress}
            pollProgress={data.pollProgress}
            onDismissProgress={() => void data.dismissProgress()}
            onSettingsChange={data.handleSettingsChange}
            onExperimentComplete={async () => {
              await data.pollProgress();
              await data.goToLatestExperiment();
              setActiveView("versions");
            }}
          />
        ) : activeView === "versions" ? (
          <div className="p-6">
            {comparisonMeta && (
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-schole-primary">
                  Experiment {data.iteration}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{comparisonMeta.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{comparisonMeta.question}</p>
              </div>
            )}
            <PageComparisonView
              experimentNumber={data.iteration}
              previousVariants={data.previousVariants}
              currentVariants={data.currentVariants}
              selectedVariantId={data.selectedVariantId}
              onSelectVariant={data.setSelectedVariantId}
              isRunning={
                (data.isRunning || data.progress?.status === "error") &&
                data.iteration === data.progressExperiment
              }
            />
          </div>
        ) : (
          <div className="bg-white">
            <ExperimentDetailPanel
              key={`${data.iterationRun?.id ?? "none"}-${data.iteration}`}
              activeView={activeView}
              run={data.iterationRun}
              variants={data.iterationVariants}
              visitIndex={data.visitIndex}
              selectedVariantId={data.selectedVariantId}
              experimentNumber={data.iteration}
              bredVariants={data.currentVariants}
              judgmentsByVariant={data.judgmentsByVariant}
            />
          </div>
        )}
      </div>
    </div>
  );
}
