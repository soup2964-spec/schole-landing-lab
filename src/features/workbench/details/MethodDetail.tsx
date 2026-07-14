"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GTM_CHALLENGE,
  POSTHOG_BEHAVIOR_WEIGHTS,
  POSTHOG_DIAGNOSTIC_EVENTS,
} from "@/domains/judgment/behavior-criteria";
import { EVALUATOR_SCORECARD_DIMENSIONS } from "@/domains/judgment/criteria";
import { DECISION_THRESHOLDS } from "@/platform/stats/bayes";
import {
  FitnessDetail,
  FunnelDetail,
  ComparisonDetail,
  EvaluatorDetail,
  DiagnosticsDetail,
} from "./MethodTierPanels";

type TierId = "fitness" | "funnel" | "comparison" | "evaluator" | "diagnostics";

const TIER_CARDS: {
  id: TierId;
  tier: string;
  title: string;
  summary: string;
  stat: string;
  accent: string;
  ring: string;
}[] = [
  {
    id: "fitness",
    tier: "Tier 1",
    title: "Fitness score",
    summary: "Ranks variants",
    stat: `${(POSTHOG_BEHAVIOR_WEIGHTS.cta_click * 100).toFixed(0)}% conversion`,
    accent: "border-schole-primary/30 bg-schole-primary/5",
    ring: "ring-schole-primary/40",
  },
  {
    id: "funnel",
    tier: "Tier 2",
    title: "Funnel metrics",
    summary: "Explains losses",
    stat: "Exposure → CTR → demo",
    accent: "border-amber-200 bg-amber-50/60",
    ring: "ring-amber-300/60",
  },
  {
    id: "comparison",
    tier: "Tier 3",
    title: "Winner comparison",
    summary: "How decisions are made",
    stat: `P(best) ≥ ${(DECISION_THRESHOLDS.promotePBest * 100).toFixed(0)}%`,
    accent: "border-slate-200 bg-slate-50",
    ring: "ring-slate-300/60",
  },
  {
    id: "evaluator",
    tier: "Tier 4",
    title: "LLM evaluator",
    summary: "Copy diagnosis",
    stat: `${EVALUATOR_SCORECARD_DIMENSIONS.length} scorecard dims`,
    accent: "border-violet-200 bg-violet-50/60",
    ring: "ring-violet-300/60",
  },
  {
    id: "diagnostics",
    tier: "Track",
    title: "PostHog events",
    summary: GTM_CHALLENGE.name,
    stat: `${POSTHOG_DIAGNOSTIC_EVENTS.length} diagnostic events`,
    accent: "border-slate-200 bg-white",
    ring: "ring-slate-300/60",
  },
];

/**
 * Comparison method — horizontal tier cards with pop-up detail panels.
 */
export function MethodDetail() {
  const [openId, setOpenId] = useState<TierId | null>("fitness");
  const popupRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpenId(null), []);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close]);

  const openCard = TIER_CARDS.find((c) => c.id === openId);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-600">
        Variants are compared in four steps: a weighted{" "}
        <strong className="font-medium text-slate-800">fitness score</strong> ranks them,{" "}
        <strong className="font-medium text-slate-800">funnel metrics</strong> explain why
        conversion moved,{" "}
        <strong className="font-medium text-slate-800">Bayesian comparison</strong> decides
        promote/kill with guardrails, and an{" "}
        <strong className="font-medium text-slate-800">LLM evaluator</strong> diagnoses copy for
        the next breeding round. Select a tier for the full criteria.
      </p>

      {/* Horizontal tier selector — single row */}
      <div className="relative">
        <div
          className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Comparison criteria tiers"
        >
          {TIER_CARDS.map((card) => {
            const active = openId === card.id;
            return (
              <button
                key={card.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`criteria-panel-${card.id}`}
                onClick={() => setOpenId(active ? null : card.id)}
                className={`flex min-w-[9.5rem] flex-1 shrink-0 flex-col rounded-xl border px-3 py-3 text-left transition ${
                  card.accent
                } ${
                  active
                    ? `ring-2 ${card.ring} shadow-md`
                    : "hover:shadow-sm hover:brightness-[0.98]"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {card.tier}
                </span>
                <span className="mt-1 text-sm font-semibold leading-tight text-slate-900">
                  {card.title}
                </span>
                <span className="mt-0.5 text-[11px] text-slate-600">{card.summary}</span>
                <span className="mt-2 truncate font-mono text-[10px] font-medium text-slate-500">
                  {card.stat}
                </span>
              </button>
            );
          })}
        </div>

        {/* Pop-up detail card */}
        {openId && openCard && (
          <div
            ref={popupRef}
            id={`criteria-panel-${openId}`}
            role="tabpanel"
            className={`relative mt-3 rounded-xl border shadow-lg ${openCard.accent}`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-black/5 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {openCard.tier}
                </p>
                <h3 className="text-base font-semibold text-slate-900">{openCard.title}</h3>
              </div>
              <button
                type="button"
                onClick={close}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                aria-label="Close criteria details"
              >
                Close
              </button>
            </div>

            <div className="max-h-[min(28rem,55vh)] overflow-y-auto p-4">
              {openId === "fitness" && <FitnessDetail />}
              {openId === "funnel" && <FunnelDetail />}
              {openId === "comparison" && <ComparisonDetail />}
              {openId === "evaluator" && <EvaluatorDetail />}
              {openId === "diagnostics" && <DiagnosticsDetail />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
