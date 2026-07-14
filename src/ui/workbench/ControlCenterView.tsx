"use client";

import { useCallback, useEffect, useState } from "react";
import { CRITERIA } from "@/config/criteria";
import type { ExperimentProgress } from "@/shared/schema/experiment-progress";
import { isProgressActivelyRunning } from "@/lab/live-loop/experiment-progress-utils";
import { LiveStatusPanel } from "@/ui/workbench/LiveStatusPanel";
import { ControlToggle } from "@/ui/workbench/ControlToggle";

interface ControlState {
  autonomous: boolean;
  runVersion: number;
  lastRunId: string | null;
  experimentMode?: "hybrid" | "full";
  llmExperimentAvailable?: boolean;
  llmProvider?: string | null;
}

export function ControlCenterView({
  progress,
  pollProgress,
  onExperimentComplete,
  onDismissProgress,
  onSettingsChange,
}: {
  progress: ExperimentProgress | null;
  pollProgress: () => Promise<void>;
  onExperimentComplete?: () => void;
  onDismissProgress?: () => void;
  onSettingsChange?: (settings: {
    autonomous: boolean;
    experimentMode: "hybrid" | "full";
  }) => void;
}) {
  const meta = CRITERIA.find((c) => c.id === "0");
  const [state, setState] = useState<ControlState | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/control");
      if (!res.ok) return;
      const data = (await res.json()) as ControlState;
      setState(data);
      onSettingsChange?.({
        autonomous: Boolean(data.autonomous),
        experimentMode: data.experimentMode ?? "hybrid",
      });
      if (data.autonomous) setLiveActive(true);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [onSettingsChange]);

  const defaultControl = useCallback(
    (): ControlState => ({
      autonomous: false,
      runVersion: 0,
      lastRunId: null,
      experimentMode: "hybrid",
      llmExperimentAvailable: false,
      llmProvider: null,
    }),
    []
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // If the server-side run ended (complete/error/stale) but the POST is still open, unlock the button.
  useEffect(() => {
    if (!isProgressActivelyRunning(progress)) {
      setRunning(false);
    }
  }, [progress]);

  const patchControl = async (patch: Partial<Pick<ControlState, "autonomous">>) => {
    setError(null);
    setMessage(null);

    const prev = state ?? defaultControl();
    setState({ ...prev, ...patch });

    try {
      const res = await fetch("/api/control", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update settings");
      }
      const body = await res.json();
      setState((s) => {
        const base = s ?? defaultControl();
        const next = {
          ...base,
          autonomous: body.autonomous ?? base.autonomous,
          experimentMode: body.experimentMode ?? base.experimentMode,
        };
        onSettingsChange?.({
          autonomous: next.autonomous,
          experimentMode: next.experimentMode ?? "hybrid",
        });
        return next;
      });
      if (typeof patch.autonomous === "boolean") {
        setLiveActive(patch.autonomous);
        if (patch.autonomous) {
          setMessage(null);
          setError(null);
        }
      }
    } catch (e) {
      setState(prev);
      setError(e instanceof Error ? e.message : "Failed to update settings");
    }
  };

  const runExperiment = async () => {
    setRunning(true);
    setError(null);
    setMessage(
      "Heuristic traffic simulation, behavior report, then optimizer breeds six angled variants."
    );

    try {
      const res = await fetch("/api/control", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Experiment failed");
      }

      if (res.status === 202 || body.started) {
        setMessage("Experiment started — pages appear in the dashboard as each one is bred.");
        await pollProgress();
        onExperimentComplete?.();
        return;
      }

      await pollProgress();

      setMessage(
        `Experiment ${body.experimentNumber} complete (hybrid, ${body.llmProvider ?? "api"}): ${body.totalVisits?.toLocaleString?.() ?? body.totalVisits} simulated visits, ${body.offspringCount} new page${body.offspringCount === 1 ? "" : "s"} bred.`
      );
      await refresh();
      onExperimentComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Experiment failed");
      await pollProgress();
    } finally {
      setRunning(false);
    }
  };

  const goLive = () => {
    setError(null);
    setMessage(null);
    setLiveActive(true);
  };

  const autonomous = state?.autonomous ?? false;
  const llmAvailable = state?.llmExperimentAvailable ?? false;
  const progressRunning = isProgressActivelyRunning(progress);
  const runBlocked = running || progressRunning || (!autonomous && !llmAvailable);

  return (
    <div className="flex min-h-[calc(100vh-65px)] items-start justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {meta && (
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-900">{meta.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{meta.question}</p>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Autonomous</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {autonomous
                  ? "Live traffic automatically recalibrates personas and re-runs the loop."
                  : "Manual mode — you trigger each experiment run."}
              </p>
            </div>
            <ControlToggle
              checked={autonomous}
              label="Autonomous mode"
              onChange={(autonomous) => patchControl({ autonomous })}
            />
          </div>

          <div className="border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={autonomous ? goLive : runExperiment}
              disabled={runBlocked}
              className="w-full rounded-xl bg-schole-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-schole-primary-hover disabled:opacity-50"
            >
              {running || progressRunning
                ? "Running experiment…"
                : autonomous
                  ? "Live"
                  : "Run experiment"}
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              {autonomous
                ? "Real visitors on variant pages feed the loop. Click Live to confirm status and share pages for people to run."
                : "Simulated buyer personas drive a behavior report; the optimizer then breeds six distinct pages (one per base angle)."}
            </p>
            {progress?.status === "error" && onDismissProgress && (
              <button
                type="button"
                onClick={onDismissProgress}
                className="mt-3 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-800 hover:bg-rose-50"
              >
                Dismiss interrupted run and unlock controls
              </button>
            )}
            {!autonomous && !llmAvailable && !loading && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Optimizer needs an API key — add{" "}
                <code className="font-mono">KIE_API_KEY</code> or{" "}
                <code className="font-mono">OPENAI_API_KEY</code> to{" "}
                <code className="font-mono">.env.local</code> and restart the dev server.
              </p>
            )}
          </div>
        </section>

        {autonomous && liveActive && !progressRunning && (
          <LiveStatusPanel onSync={() => refresh()} />
        )}

        {running && !progress && !autonomous && (
          <p
            className="rounded-xl border border-schole-primary/20 bg-schole-primary/5 px-4 py-3 text-sm text-slate-700"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            {message}
          </p>
        )}
        {!running && !autonomous && message && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
