"use client";

import { CRITERIA } from "@/content/criteria";
import type { ExperimentRun } from "@/platform/schema/experiment";
import type { VisitIndex } from "@/platform/registry";
import type { PageVariant } from "@/platform/schema/page";
import type { VariantJudgment } from "@/domains/judgment/criteria";
import { BehaviorReport } from "./details/BehaviorReport";
import { ChangelogDetail } from "./details/ChangelogDetail";
import { PersonasDetail } from "./details/PersonasDetail";
import { MethodDetail } from "./details/MethodDetail";
import { NewVariantsDetail } from "./details/NewVariantsDetail";
import { VersionsDetail } from "./details/VersionsDetail";
import { WinnersDetail } from "./details/WinnersDetail";
import type { WorkbenchView } from "./ExperimentSideMenu";

export type DetailTab = "method" | "personas" | "behavior" | "winners" | "new" | "changelog";

const VIEW_CRITERION: Record<WorkbenchView, string> = {
  control: "0",
  versions: "1",
  method: "2",
  personas: "3",
  behavior: "4",
  winners: "5",
  new: "6",
  changelog: "7",
};

export function ExperimentDetailPanel({
  activeView,
  run,
  variants,
  visitIndex,
  selectedVariantId,
  experimentNumber,
  bredVariants = [],
  judgmentsByVariant = {},
  experimentMode = "hybrid",
  llmPersonas = false,
}: {
  activeView: WorkbenchView;
  run: ExperimentRun | null;
  variants: PageVariant[];
  visitIndex: VisitIndex | null;
  selectedVariantId?: string | null;
  experimentNumber?: number;
  bredVariants?: PageVariant[];
  judgmentsByVariant?: Record<string, VariantJudgment>;
  experimentMode?: "hybrid" | "full";
  llmPersonas?: boolean;
}) {
  const meta = CRITERIA.find((c) => c.id === VIEW_CRITERION[activeView]);

  return (
    <div className="p-5">
      {meta && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-schole-primary">
            Experiment {experimentNumber ?? 1}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{meta.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{meta.question}</p>
        </div>
      )}

      {activeView === "versions" && <VersionsDetail variants={variants} />}
      {activeView === "method" && <MethodDetail />}
      {activeView === "personas" && <PersonasDetail run={run} />}
      {activeView === "behavior" && (
        <BehaviorReport
          run={run}
          index={visitIndex}
          variants={variants}
          selectedVariantId={selectedVariantId}
          experimentMode={experimentMode}
          llmPersonas={llmPersonas}
        />
      )}
      {activeView === "winners" && (
        <WinnersDetail run={run} variants={variants} judgmentsByVariant={judgmentsByVariant} />
      )}
      {activeView === "new" && (
        <NewVariantsDetail run={run} variants={variants} bredVariants={bredVariants} />
      )}
      {activeView === "changelog" && (
        <ChangelogDetail variants={variants} bredVariants={bredVariants} />
      )}
    </div>
  );
}
