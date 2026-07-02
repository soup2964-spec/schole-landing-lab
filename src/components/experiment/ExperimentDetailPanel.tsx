"use client";

import { CRITERIA } from "@/config/criteria";
import type { ExperimentRun } from "@/lib/schema/experiment";
import type { VisitIndex } from "@/lib/registry";
import type { PageVariant } from "@/lib/schema/page";
import { BehaviorDetail } from "./details/BehaviorDetail";
import { ChangelogDetail } from "./details/ChangelogDetail";
import { MethodDetail } from "./details/MethodDetail";
import { NewVariantsDetail } from "./details/NewVariantsDetail";
import { WinnersDetail } from "./details/WinnersDetail";

export type DetailTab = "method" | "behavior" | "winners" | "new" | "changelog";

const TABS: { id: DetailTab; label: string; criterionId: string }[] = [
  { id: "method", label: "Method", criterionId: "2" },
  { id: "behavior", label: "Behavior", criterionId: "3" },
  { id: "winners", label: "Winners", criterionId: "4" },
  { id: "new", label: "New", criterionId: "5" },
  { id: "changelog", label: "Why", criterionId: "6" },
];

export function ExperimentDetailPanel({
  activeTab,
  onTabChange,
  run,
  variants,
  visitIndex,
  selectedVariantId,
}: {
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  run: ExperimentRun | null;
  variants: PageVariant[];
  visitIndex: VisitIndex | null;
  selectedVariantId?: string | null;
}) {
  const meta = CRITERIA.find((c) => c.id === TABS.find((t) => t.id === activeTab)?.criterionId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "border-schole-primary text-schole-primary"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {meta && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">{meta.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{meta.question}</p>
          </div>
        )}

        {activeTab === "method" && <MethodDetail run={run} />}
        {activeTab === "behavior" && (
          <BehaviorDetail
            index={visitIndex}
            variants={variants}
            selectedVariantId={selectedVariantId}
          />
        )}
        {activeTab === "winners" && <WinnersDetail run={run} variants={variants} />}
        {activeTab === "new" && <NewVariantsDetail variants={variants} />}
        {activeTab === "changelog" && <ChangelogDetail variants={variants} />}
      </div>
    </div>
  );
}
