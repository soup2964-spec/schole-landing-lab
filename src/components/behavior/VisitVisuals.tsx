"use client";

import type { VisitSummary, VisitIndex } from "@/lib/registry";
import type { PageVariant } from "@/lib/schema/page";

const ACTION_COLORS = {
  read: "bg-indigo-500",
  skim: "bg-amber-400",
  bounce: "bg-rose-500",
} as const;

/** Horizontal strip showing which sections a persona read, skimmed, or bounced on. */
export function VisitPathStrip({
  path,
  sections,
  compact,
}: {
  path: VisitSummary["path"];
  sections: PageVariant["sections"];
  compact?: boolean;
}) {
  if (!path.length) {
    return <span className="text-xs text-slate-600">No section data</span>;
  }

  const labelById = new Map(sections.map((s) => [s.id, s.type.replace(/_/g, " ")]));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {path.map((step, i) => (
        <div key={`${step.sectionId}-${i}`} className="group relative flex items-center">
          <div
            className={`${compact ? "h-2 w-5" : "h-3 w-7"} rounded-sm ${ACTION_COLORS[step.action]} opacity-90`}
            title={`${labelById.get(step.sectionId) ?? step.sectionId} · ${step.action}`}
          />
          {i < path.length - 1 && (
            <span className={`mx-0.5 text-slate-700 ${compact ? "text-[8px]" : "text-[10px]"}`}>→</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Full-page section heatmap for a variant — read rate per section as colored blocks. */
export function VariantSectionHeatmap({
  variant,
  perSection,
}: {
  variant: PageVariant;
  perSection: { sectionId: string; views: number; reads: number; exitRate: number }[];
}) {
  const byId = new Map(perSection.map((p) => [p.sectionId, p]));

  return (
    <div className="space-y-2">
      {variant.sections.map((s) => {
        const ps = byId.get(s.id);
        const readRate = ps && ps.views ? ps.reads / ps.views : 0;
        const exitRate = ps?.exitRate ?? 0;
        const intensity = Math.round(readRate * 100);
        const bg =
          intensity >= 70
            ? "from-indigo-600/80 to-indigo-500/40"
            : intensity >= 40
              ? "from-indigo-500/50 to-slate-800"
              : "from-slate-800 to-slate-900";

        return (
          <div
            key={s.id}
            className={`rounded-xl border border-slate-800 bg-gradient-to-r ${bg} p-3`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{s.type}</div>
                <div className="truncate text-sm font-medium text-white">{s.headline}</div>
              </div>
              <div className="flex-none text-right text-xs">
                <div className="font-semibold text-indigo-300">{intensity}% read</div>
                {exitRate > 0.05 && (
                  <div className="text-rose-400/90">{(exitRate * 100).toFixed(0)}% exit</div>
                )}
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950/50">
              <div
                className="h-full rounded-full bg-indigo-400"
                style={{ width: `${intensity}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ScrollDepthBar({ depth }: { depth: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400"
          style={{ width: `${Math.min(100, depth * 100)}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-slate-500">{(depth * 100).toFixed(0)}%</span>
    </div>
  );
}

export type GenerationIndex = VisitIndex[number];
