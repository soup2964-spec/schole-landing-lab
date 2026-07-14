"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VisitIndex } from "@/shared/registry";
import type { ExperimentRun } from "@/shared/schema/experiment";
import type { PageVariant } from "@/shared/schema/page";
import type { LiveBehaviorSnapshot } from "@/shared/db/live-store";
import { BehaviorDashboard } from "@/ui/workbench/behavior/BehaviorDashboard";
import { VariantSectionHeatmap } from "@/ui/workbench/behavior/VisitVisuals";
import { formatFunnelPct } from "@/lab/analytics/funnel-metrics";
import { variantPageTitle } from "@/lab/variants/display-name";

type DataMode = "live" | "simulated" | "loading";

/**
 * User behavior section — answers "What did personas do on each page?"
 * Simulated: visit replay, scroll paths, section engagement, objections.
 * Live: real session aggregates when Supabase is connected.
 */
export function BehaviorReport({
  run: _run,
  index,
  variants,
  selectedVariantId,
}: {
  run: ExperimentRun | null;
  index: VisitIndex | null;
  variants: PageVariant[];
  selectedVariantId?: string | null;
}) {
  const [live, setLive] = useState<LiveBehaviorSnapshot | null>(null);
  const [liveConfigured, setLiveConfigured] = useState<boolean | null>(null);
  const [loadingLive, setLoadingLive] = useState(true);

  const refreshLive = useCallback(async () => {
    setLoadingLive(true);
    try {
      const res = await fetch("/api/behavior/live?days=30");
      if (res.status === 503) {
        setLiveConfigured(false);
        setLive(null);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setLiveConfigured(true);
        return;
      }
      setLiveConfigured(true);
      setLive(data as LiveBehaviorSnapshot);
    } catch {
      setLiveConfigured(false);
    } finally {
      setLoadingLive(false);
    }
  }, []);

  useEffect(() => {
    refreshLive();
    const t = setInterval(refreshLive, 30_000);
    return () => clearInterval(t);
  }, [refreshLive]);

  const hasLiveData = Boolean(live?.totalSessions);
  const hasSimData = Boolean(index?.length);
  const mode: DataMode = loadingLive
    ? "loading"
    : hasSimData
      ? "simulated"
      : hasLiveData
        ? "live"
        : "simulated";

  if (mode === "loading" && !hasSimData) {
    return <p className="text-sm text-slate-500">Loading behavior data…</p>;
  }

  if (!hasSimData && !hasLiveData && !loadingLive) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          No behavior data yet. Run an experiment from the Control tab to simulate persona visits, or open a variant page (e.g.{" "}
          <code className="rounded bg-slate-100 px-1">/v/v1-roi</code>) to record live sessions.
        </p>
        {!liveConfigured && (
          <p className="text-xs text-slate-500">
            Optional live tracking: set Supabase env vars and run the migration in{" "}
            <code className="rounded bg-slate-100 px-1">supabase/migrations/</code>.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-slate-600">
        Heuristic persona models simulate buyer visits — scroll depth, section reads, objections, and
        demo clicks.{" "}
        Pick a persona and visit below to replay what happened on each page and why they converted
        or left. Persona cards show <strong>observed visits and conversion</strong> for the selected
        variant and generation from this experiment — not static priors.
        {selectedVariantId ? (
          <>
            {" "}
            Highlighting{" "}
            <code className="rounded bg-slate-100 px-1">{selectedVariantId}</code> from page
            comparison.
          </>
        ) : null}
      </p>

      {hasSimData && index && (
        <BehaviorDashboard
          index={index}
          variants={variants}
          initialVariantId={selectedVariantId}
          runId={_run?.id ?? null}
        />
      )}

      {hasLiveData && live && (
        <LiveBehaviorSummary live={live} variants={variants} />
      )}
    </div>
  );
}

function LiveBehaviorSummary({
  live,
  variants,
}: {
  live: LiveBehaviorSnapshot;
  variants: PageVariant[];
}) {
  const [activeId, setActiveId] = useState(live.metrics[0]?.variantId ?? "");
  const nameById = useMemo(
    () => new Map(variants.map((v) => [v.id, variantPageTitle(v)])),
    [variants]
  );

  const activeMetrics = live.metrics.find((m) => m.variantId === activeId);
  const activeVariant = variants.find((v) => v.id === activeId);
  const totals = live.totals;

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Live sessions</h3>
        <span className="text-xs text-slate-500">
          Last {live.windowDays} days · {totals.visits.toLocaleString()} sessions
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <LiveKpi label="Conversion" value={`${(totals.conversionRate * 100).toFixed(1)}%`} accent />
        <LiveKpi label="Bounce" value={`${(totals.bounceRate * 100).toFixed(0)}%`} />
        <LiveKpi label="Avg scroll" value={`${(totals.avgScroll * 100).toFixed(0)}%`} />
        <LiveKpi label="CTA exposure" value={formatFunnelPct(totals.funnel.ctaExposureRate, 0)} />
        <LiveKpi label="CTA CTR" value={formatFunnelPct(totals.funnel.ctaClickThroughRate, 0)} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {live.metrics.map((m) => (
          <button
            key={m.variantId}
            type="button"
            onClick={() => setActiveId(m.variantId)}
            className={`min-w-[8rem] flex-1 shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition ${
              m.variantId === activeId
                ? "border-emerald-400 bg-white ring-2 ring-emerald-300/40"
                : "border-slate-200 bg-white hover:shadow-sm"
            }`}
          >
            <div className="font-medium text-slate-900">
              {nameById.get(m.variantId) ?? m.variantId}
            </div>
            <div className="mt-0.5 tabular-nums text-slate-500">
              {(m.conversionRate * 100).toFixed(1)}% · {m.visits} sessions
            </div>
          </button>
        ))}
      </div>

      {activeVariant && activeMetrics && (
        <div className="rounded-xl border border-white bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">
            Section engagement · {variantPageTitle(activeVariant)}
          </h4>
          <div className="mt-3">
            <VariantSectionHeatmap
              variant={activeVariant}
              perSection={activeMetrics.perSection}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function LiveKpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent ? "border-emerald-300/60 bg-white" : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}
