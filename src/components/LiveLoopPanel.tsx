"use client";

import { useCallback, useEffect, useState } from "react";

interface LoopStatus {
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

interface LoopResponse {
  status: LoopStatus;
  autoSync?: { synced: boolean; reason: string; runVersion?: number } | null;
}

/**
 * Polls the live loop API every 30s. When enough real visitors accumulate,
 * the server auto-calibrates personas and re-runs the simulation.
 */
export function LiveLoopPanel({ onUpdate }: { onUpdate?: (runVersion: number) => void }) {
  const [data, setData] = useState<LoopResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/loop");
      const json = (await res.json()) as LoopResponse;
      setData(json);
      if (json.autoSync?.synced) {
        setLastEvent(`Auto-synced · run v${json.autoSync.runVersion}`);
        onUpdate?.(json.status.runVersion);
      }
    } catch {
      /* ignore poll errors */
    }
  }, [onUpdate]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 30_000);
    return () => clearInterval(t);
  }, [poll]);

  const forceSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const json = await res.json();
      setData(json);
      if (json.result?.synced) {
        setLastEvent(`Synced · run v${json.result.runVersion}`);
        onUpdate?.(json.status.runVersion);
      } else {
        setLastEvent(json.result?.reason ?? "Sync skipped");
      }
    } finally {
      setSyncing(false);
    }
  };

  const s = data?.status;
  if (!s) return null;

  return (
    <section className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${s.liveVisitors > 0 ? "animate-pulse bg-emerald-400" : "bg-slate-600"}`}
            />
            <h2 className="font-semibold text-white">Live learning loop</h2>
          </div>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Real visitors on variant pages feed PostHog/GTM. After{" "}
            <strong className="text-slate-300">5 new sessions</strong>, the system recalibrates
            persona priors and re-runs the simulation — predictions update automatically.
          </p>
        </div>
        <button
          onClick={forceSync}
          disabled={syncing || s.liveVisitors === 0}
          className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {syncing ? "Syncing…" : "Force sync now"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <LiveStat label="Live visitors" value={String(s.liveVisitors)} highlight />
        <LiveStat label="New since sync" value={String(s.newVisitorsSinceSync)} />
        <LiveStat label="Run version" value={`v${s.runVersion}`} />
        <LiveStat label="Calibration" value={`v${s.calibrationVersion}`} />
        <LiveStat
          label="Last sync"
          value={s.lastSyncAt ? timeAgo(s.lastSyncAt) : "Never"}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <StatusChip ok={s.posthogConfigured} label="PostHog API" />
        <StatusChip ok={s.heartbeatVisits > 0} label={`Heartbeat (${s.heartbeatVisits})`} />
        <span
          className={`rounded-full px-3 py-1 ${
            s.readyToSync
              ? "bg-amber-500/15 text-amber-300"
              : "bg-slate-800 text-slate-500"
          }`}
        >
          {s.nextSyncReason}
        </span>
      </div>

      {lastEvent && (
        <p className="mt-3 text-xs text-emerald-400">{lastEvent} — refresh behavior/results to see updates</p>
      )}

      <div className="mt-4 rounded-xl bg-slate-950/50 p-3 font-mono text-[10px] leading-relaxed text-slate-600">
        live traffic → calibrate personas → re-simulate → dashboard updates (polls every 30s)
      </div>
    </section>
  );
}

function LiveStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? "border-indigo-500/40 bg-indigo-500/10" : "border-slate-800 bg-slate-900/60"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 ${
        ok ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
      }`}
    >
      {label}
    </span>
  );
}

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
