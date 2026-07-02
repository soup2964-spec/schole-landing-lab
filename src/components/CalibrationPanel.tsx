"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalibrationRecord, RealMetricsSnapshot, SimulatedMetricsSnapshot } from "@/lib/calibration/types";

const BENCHMARKS = {
  conversionRate: { label: "Demo booking CTA", low: 0.02, high: 0.05, source: "Unbounce B2B SaaS benchmarks" },
  bounceRate: { label: "Bounce rate", low: 0.4, high: 0.6, source: "Typical B2B landing pages" },
  scrollAboveFold: { label: "Time above fold", low: 0.57, high: 0.57, source: "Nielsen Norman Group scroll research" },
};

interface CalibrationResponse {
  simulated: SimulatedMetricsSnapshot | null;
  real: RealMetricsSnapshot | null;
  calibration: CalibrationRecord | null;
  configured: {
    posthog: boolean;
    posthogApi: boolean;
    gtm: boolean;
    clarity: boolean;
  };
  fetchError: string | null;
}

export function CalibrationPanel({
  simulated: simulatedProp,
}: {
  simulated?: SimulatedMetricsSnapshot;
}) {
  const [data, setData] = useState<CalibrationResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/calibration");
    setData(await res.json());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runCalibration = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/calibration", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Calibration failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calibration failed");
    } finally {
      setRunning(false);
    }
  };

  const simulated = data?.simulated ?? simulatedProp;
  const real = data?.real;
  const calibration = data?.calibration;
  const configured = data?.configured;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-white">Simulated vs. live calibration</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Every variant page fires the same events to{" "}
            <strong className="text-slate-300">PostHog</strong> (product analytics),{" "}
            <strong className="text-slate-300">Google Tag Manager</strong> (GA4 / Ads), and optional{" "}
            <strong className="text-slate-300">Clarity</strong>. Real traffic closes the loop:
            when live conversion, bounce, and scroll diverge from simulation, persona parameters
            are adjusted for the next prediction run.
          </p>
        </div>
        <button
          onClick={runCalibration}
          disabled={running || !configured?.posthogApi}
          className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? "Calibrating…" : "Run calibration"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <StatusPill label="PostHog" ok={configured?.posthog} />
        <StatusPill label="PostHog API" ok={configured?.posthogApi} detail="for live pull" />
        <StatusPill label="GTM" ok={configured?.gtm} />
        <StatusPill label="Clarity" ok={configured?.clarity} />
      </div>

      {data?.fetchError && (
        <p className="mt-3 text-xs text-amber-400">PostHog fetch: {data.fetchError}</p>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-4">Metric</th>
              <th className="pb-2 pr-4">Simulated</th>
              <th className="pb-2 pr-4">Live (PostHog)</th>
              <th className="pb-2">Benchmark</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            <MetricRow
              label="Conversion rate"
              sim={simulated ? pct(simulated.conversionRate) : "—"}
              live={real ? pct(real.aggregate.conversionRate) : "—"}
              bench={`${BENCHMARKS.conversionRate.low * 100}-${BENCHMARKS.conversionRate.high * 100}%`}
              liveVisitors={real?.aggregate.visitors}
            />
            <MetricRow
              label="Bounce rate"
              sim={simulated ? pct(simulated.bounceRate) : "—"}
              live={real ? pct(real.aggregate.bounceRate) : "—"}
              bench={`${BENCHMARKS.bounceRate.low * 100}-${BENCHMARKS.bounceRate.high * 100}%`}
            />
            <MetricRow
              label="Avg scroll depth"
              sim={simulated ? pct(simulated.avgScrollDepth) : "—"}
              live={real ? pct(real.aggregate.avgScrollDepth) : "—"}
              bench="position-biased (NNG)"
            />
          </tbody>
        </table>
      </div>

      {real && real.byVariant.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Per-variant live traffic ({real.windowDays}d)
          </h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {real.byVariant.map((v) => (
              <div key={v.variantId} className="rounded-xl border border-slate-800 px-3 py-2 text-xs">
                <span className="font-mono text-slate-400">{v.variantId}</span>
                <span className="ml-2 text-white">{pct(v.conversionRate)} conv</span>
                <span className="ml-2 text-slate-500">{v.visitors} visitors</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {calibration && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-100/90">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Persona calibration v{calibration.version}
          </div>
          <p className="mt-1 text-slate-300">{calibration.changelog}</p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-slate-400">
            <li>ctaPropensity × {calibration.adjustments.ctaPropensityMultiplier.toFixed(3)}</li>
            <li>patienceSeconds {calibration.adjustments.patienceSecondsDelta >= 0 ? "+" : ""}{calibration.adjustments.patienceSecondsDelta}s</li>
            <li>skimPropensity {calibration.adjustments.skimPropensityDelta >= 0 ? "+" : ""}{calibration.adjustments.skimPropensityDelta.toFixed(3)}</li>
          </ul>
        </div>
      )}

      <div className="mt-4 rounded-xl bg-slate-950/60 p-4 text-xs text-slate-500">
        Events pushed to GTM <code className="rounded bg-slate-800 px-1">dataLayer</code>:{" "}
        <code className="rounded bg-slate-800 px-1">variant_page_view</code>,{" "}
        <code className="rounded bg-slate-800 px-1">cta_click</code>,{" "}
        <code className="rounded bg-slate-800 px-1">scroll_depth</code>,{" "}
        <code className="rounded bg-slate-800 px-1">page_exit</code>. PostHog receives the same
        properties for HogQL aggregation. Set{" "}
        <code className="rounded bg-slate-800 px-1">POSTHOG_API_KEY</code> +{" "}
        <code className="rounded bg-slate-800 px-1">POSTHOG_PROJECT_ID</code> to pull live
        metrics and write <code className="rounded bg-slate-800 px-1">data/calibration.json</code>.
      </div>
    </section>
  );
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function StatusPill({
  label,
  ok,
  detail,
}: {
  label: string;
  ok?: boolean;
  detail?: string;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 ${
        ok ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
      }`}
    >
      {label}
      {detail && ok ? ` · ${detail}` : ""}
      {!ok ? " · not configured" : ""}
    </span>
  );
}

function MetricRow({
  label,
  sim,
  live,
  bench,
  liveVisitors,
}: {
  label: string;
  sim: string;
  live: string;
  bench: string;
  liveVisitors?: number;
}) {
  return (
    <tr className="border-b border-slate-800/60">
      <td className="py-3 pr-4 text-slate-400">{label}</td>
      <td className="py-3 pr-4 font-medium text-white">{sim}</td>
      <td className="py-3 pr-4 font-medium text-indigo-300">
        {live}
        {liveVisitors != null && liveVisitors > 0 && (
          <span className="ml-1 text-xs font-normal text-slate-500">({liveVisitors} visitors)</span>
        )}
      </td>
      <td className="py-3 text-xs text-slate-600">{bench}</td>
    </tr>
  );
}

export function CalibrationPageShell() {
  return null;
}
