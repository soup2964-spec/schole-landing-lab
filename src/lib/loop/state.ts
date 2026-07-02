import fs from "fs";
import path from "path";

export interface LoopState {
  /** Monotonic version — bumps on each full sync (calibrate + re-simulate). */
  runVersion: number;
  lastSyncAt: string | null;
  /** Live visitors counted at last sync (PostHog + heartbeat). */
  lastVisitorCount: number;
  /** Heartbeat visits recorded since deploy (works without PostHog API). */
  heartbeatVisits: number;
  lastCalibrationVersion: number;
  lastRunId: string | null;
  syncHistory: { at: string; visitors: number; reason: string }[];
}

const STATE_PATH = path.join(process.cwd(), "data", "loop-state.json");

const DEFAULT_STATE: LoopState = {
  runVersion: 0,
  lastSyncAt: null,
  lastVisitorCount: 0,
  heartbeatVisits: 0,
  lastCalibrationVersion: 0,
  lastRunId: null,
  syncHistory: [],
};

export function loadLoopState(): LoopState {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveLoopState(state: LoopState) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

export function recordHeartbeat() {
  const state = loadLoopState();
  state.heartbeatVisits += 1;
  saveLoopState(state);
  return state.heartbeatVisits;
}

export function minNewVisitors() {
  return Number(process.env.LOOP_MIN_NEW_VISITORS ?? 5);
}

export function minSyncIntervalMs() {
  return Number(process.env.LOOP_MIN_SYNC_MS ?? 3 * 60 * 1000);
}
