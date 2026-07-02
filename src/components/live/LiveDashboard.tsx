"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { LiveLoopPanel } from "@/components/LiveLoopPanel";
import { CalibrationPanel } from "@/components/CalibrationPanel";
import { schole } from "@/components/schole-ui";
import type { PageVariant } from "@/lib/schema/page";
import type { SimulatedMetricsSnapshot } from "@/lib/calibration/types";

export function LiveDashboard({
  variants,
  simulated,
}: {
  variants: PageVariant[];
  simulated?: SimulatedMetricsSnapshot;
}) {
  const [runVersion, setRunVersion] = useState(0);

  const onLoopUpdate = useCallback((v: number) => setRunVersion(v), []);

  return (
    <div className="space-y-8" key={runVersion}>
      <div className="rounded-2xl border-2 border-emerald-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Live version</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Every variant at <code className={schole.code}>/v/[variantId]</code> fires real
              analytics events. This dashboard pulls live PostHog metrics, compares them to the
              simulation, and re-calibrates persona priors when enough new sessions arrive.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-800">Listening for live traffic</span>
          </div>
        </div>
      </div>

      <LiveLoopPanel onUpdate={onLoopUpdate} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Live variant pages</h2>
        <p className="mt-1 text-sm text-slate-600">
          Share these URLs to collect real behavior. Each page tags events with its variant ID.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {variants.map((v) => (
            <div key={v.id} className={schole.cardMuted}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Gen {v.generation} · {v.strategy}
              </div>
              <h3 className="mt-1 font-medium text-slate-900">{v.name}</h3>
              <code className="mt-1 block text-[10px] text-slate-500">{v.id}</code>
              <Link href={`/v/${v.id}`} target="_blank" className={`${schole.btnPrimary} mt-3`}>
                Open live page ↗
              </Link>
            </div>
          ))}
        </div>
      </section>

      <CalibrationPanel simulated={simulated} />

      <LiveEventsReference />
    </div>
  );
}

function LiveEventsReference() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
        Instrumentation reference
      </h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        <li>
          <strong className="text-slate-900">PostHog</strong> — variant_page_view, cta_click,
          scroll_depth, page_exit (with variantId, generation, strategy)
        </li>
        <li>
          <strong className="text-slate-900">GTM / GA4</strong> — same events pushed to dataLayer
        </li>
        <li>
          <strong className="text-slate-900">Clarity</strong> — optional session replay per variant
          tag
        </li>
        <li>
          <strong className="text-slate-900">Auto-sync</strong> — after 5 new sessions, personas
          recalibrate and the simulation re-runs (updates the simulation dashboard)
        </li>
      </ul>
    </section>
  );
}
