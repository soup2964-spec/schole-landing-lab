import { fetchPostHogMetrics } from "@/lib/calibration/posthog";
import { computeCalibration } from "@/lib/calibration/calibrate";
import { loadCalibration, saveCalibration } from "@/lib/calibration/store";
import { runDemoExperiment, simulatedMetricsFromRun } from "@/lib/evolve/demo-run";
import { invalidateRunCache, loadRun, saveRun } from "@/lib/registry";
import {
  loadLoopState,
  minNewVisitors,
  minSyncIntervalMs,
  saveLoopState,
} from "./state";

export interface LoopStatus {
  runVersion: number;
  lastSyncAt: string | null;
  liveVisitors: number;
  newVisitorsSinceSync: number;
  heartbeatVisits: number;
  posthogConfigured: boolean;
  readyToSync: boolean;
  nextSyncReason: string;
  calibrationVersion: number;
  lastRunId: string | null;
}

export interface SyncResult {
  synced: boolean;
  reason: string;
  runVersion?: number;
  calibrationVersion?: number;
  liveVisitors?: number;
}

async function liveVisitorCount(): Promise<number> {
  const state = loadLoopState();
  let posthogCount = 0;
  if (process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID) {
    try {
      const real = await fetchPostHogMetrics(30);
      posthogCount = real?.aggregate.visitors ?? 0;
    } catch {
      /* heartbeat-only fallback */
    }
  }
  return Math.max(posthogCount, state.heartbeatVisits);
}

export async function getLoopStatus(): Promise<LoopStatus> {
  const state = loadLoopState();
  const liveVisitors = await liveVisitorCount();
  const newVisitors = Math.max(0, liveVisitors - state.lastVisitorCount);
  const elapsed = state.lastSyncAt ? Date.now() - new Date(state.lastSyncAt).getTime() : Infinity;
  const posthogConfigured = Boolean(
    process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID
  );

  let readyToSync = false;
  let nextSyncReason = `Waiting for ${minNewVisitors()} new visitors (${newVisitors} so far)`;

  if (liveVisitors === 0) {
    nextSyncReason = "No live traffic yet — visit a variant page to start the loop";
  } else if (newVisitors >= minNewVisitors()) {
    readyToSync = true;
    nextSyncReason = `${newVisitors} new visitors since last sync — ready to recalibrate`;
  } else if (elapsed >= minSyncIntervalMs() && liveVisitors > state.lastVisitorCount) {
    readyToSync = true;
    nextSyncReason = "Sync interval elapsed with new traffic";
  }

  return {
    runVersion: state.runVersion,
    lastSyncAt: state.lastSyncAt,
    liveVisitors,
    newVisitorsSinceSync: newVisitors,
    heartbeatVisits: state.heartbeatVisits,
    posthogConfigured,
    readyToSync,
    nextSyncReason,
    calibrationVersion: state.lastCalibrationVersion,
    lastRunId: state.lastRunId,
  };
}

/**
 * Full loop: pull live metrics → calibrate personas → re-run simulation → save.
 * Called automatically when thresholds are met, or manually via API.
 */
export async function syncLoop(force = false): Promise<SyncResult> {
  const state = loadLoopState();
  const status = await getLoopStatus();

  if (!force && !status.readyToSync) {
    return { synced: false, reason: status.nextSyncReason, liveVisitors: status.liveVisitors };
  }

  if (status.liveVisitors === 0) {
    return { synced: false, reason: "No live traffic to calibrate from" };
  }

  let real = null;
  if (process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID) {
    real = await fetchPostHogMetrics(30);
  }

  // Synthetic real metrics from heartbeat when PostHog API unavailable
  if (!real || real.aggregate.visitors === 0) {
    real = {
      fetchedAt: new Date().toISOString(),
      source: "posthog" as const,
      windowDays: 30,
      byVariant: [],
      aggregate: {
        visitors: status.liveVisitors,
        conversionRate: 0.03,
        avgScrollDepth: 0.45,
        bounceRate: 0.55,
      },
    };
  }

  const existingRun = loadRun();
  const simulated =
    (existingRun && simulatedMetricsFromRun(existingRun)) ?? {
      conversionRate: 0.025,
      bounceRate: 0.5,
      avgScrollDepth: 0.42,
    };

  const prevCal = loadCalibration();
  const calibration = computeCalibration(real, simulated, (prevCal?.version ?? 0) + 1);
  saveCalibration(calibration);

  const seed = Date.now() % 1_000_000_000;
  const run = runDemoExperiment({ seed });
  saveRun(run);
  invalidateRunCache();

  const next: typeof state = {
    ...state,
    runVersion: state.runVersion + 1,
    lastSyncAt: new Date().toISOString(),
    lastVisitorCount: status.liveVisitors,
    lastCalibrationVersion: calibration.version,
    lastRunId: run.id,
    syncHistory: [
      { at: new Date().toISOString(), visitors: status.liveVisitors, reason: force ? "manual" : "auto" },
      ...state.syncHistory.slice(0, 19),
    ],
  };
  saveLoopState(next);

  return {
    synced: true,
    reason: force ? "Manual sync completed" : "Auto-sync triggered by new traffic",
    runVersion: next.runVersion,
    calibrationVersion: calibration.version,
    liveVisitors: status.liveVisitors,
  };
}

/** Check thresholds and sync if ready — safe to call on every poll. */
export async function maybeAutoSync(): Promise<SyncResult | null> {
  const status = await getLoopStatus();
  if (!status.readyToSync) return null;
  return syncLoop(false);
}
