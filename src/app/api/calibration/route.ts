import { NextResponse } from "next/server";
import { POSTHOG_EVENTS } from "@/lib/analytics/posthog-events";
import { loadRun } from "@/lib/registry";
import { fetchPostHogMetrics } from "@/lib/calibration/posthog";
import { computeCalibration } from "@/lib/calibration/calibrate";
import { loadCalibration, saveCalibration } from "@/lib/calibration/store";
import type { SimulatedMetricsSnapshot } from "@/lib/calibration/types";

async function simulatedFromRun(): Promise<SimulatedMetricsSnapshot | null> {
  const run = await loadRun();
  if (!run?.generations.length) return null;
  const last = run.generations[run.generations.length - 1];
  const visits = last.visits;
  if (!visits.length) return null;
  return {
    conversionRate: visits.filter((v) => v.converted).length / visits.length,
    bounceRate:
      visits.filter((v) =>
        v.events.some((e) => e.type === POSTHOG_EVENTS.PAGE_EXIT && e.bounced)
      ).length / visits.length,
    avgScrollDepth: visits.reduce((s, v) => s + v.scrollDepth, 0) / visits.length,
  };
}

export async function GET() {
  const simulated = await simulatedFromRun();
  const stored = await loadCalibration();

  let real = stored?.real ?? null;
  let fetchError: string | null = null;

  if (process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID) {
    try {
      real = await fetchPostHogMetrics(30);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "PostHog fetch failed";
    }
  }

  return NextResponse.json({
    simulated,
    real,
    calibration: stored,
    configured: {
      posthog: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
      posthogApi: Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID),
      gtm: Boolean(process.env.NEXT_PUBLIC_GTM_ID),
      clarity: Boolean(process.env.NEXT_PUBLIC_CLARITY_ID),
      supabase: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
    },
    fetchError,
  });
}

export async function POST() {
  const simulated = await simulatedFromRun();
  if (!simulated) {
    return NextResponse.json({ error: "No simulated run found. Run an experiment first." }, { status: 400 });
  }

  let real;
  try {
    real = await fetchPostHogMetrics(30);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PostHog fetch failed" },
      { status: 502 }
    );
  }

  if (!real || real.aggregate.visitors === 0) {
    return NextResponse.json(
      {
        error:
          "No real traffic yet. Visit variant pages (/v/v0-baseline etc.) with PostHog configured, then retry.",
      },
      { status: 404 }
    );
  }

  const prev = await loadCalibration();
  const record = computeCalibration(real, simulated, (prev?.version ?? 0) + 1);
  await saveCalibration(record);

  return NextResponse.json({ ok: true, calibration: record });
}
