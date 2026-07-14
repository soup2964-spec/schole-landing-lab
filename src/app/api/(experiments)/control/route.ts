import { after, NextResponse } from "next/server";
import {
  isLlmExperimentAvailable,
  llmExperimentProviderLabel,
  manualExperimentMode,
  runManualExperiment,
} from "@/lab/live-loop/manual-experiment";
import { isProgressActivelyRunning, loadExperimentProgress } from "@/lab/live-loop/experiment-progress";
import { isAutonomousMode, loadLoopState, saveLoopState } from "@/lab/live-loop/state";

/** Background experiment via after() — Hobby plan caps at 300s. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET() {
  const state = await loadLoopState();
  return NextResponse.json({
    autonomous: isAutonomousMode(state),
    llmPersonas: false,
    runVersion: state.runVersion,
    lastRunId: state.lastRunId,
    lastSyncAt: state.lastSyncAt,
    experimentMode: manualExperimentMode(),
    llmExperimentAvailable: isLlmExperimentAvailable(),
    llmProvider: llmExperimentProviderLabel(),
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    autonomous?: boolean;
  };

  if (typeof body.autonomous !== "boolean") {
    return NextResponse.json(
      { error: "Provide autonomous (boolean)" },
      { status: 400 }
    );
  }

  const state = await loadLoopState();
  const next = {
    ...state,
    autonomous: body.autonomous,
    llmPersonas: false,
  };
  await saveLoopState(next);

  return NextResponse.json({
    autonomous: next.autonomous,
    llmPersonas: false,
    experimentMode: manualExperimentMode(),
  });
}

export async function POST() {
  const state = await loadLoopState();
  if (isAutonomousMode(state)) {
    return NextResponse.json(
      { error: "Turn off Autonomous mode to run an experiment manually" },
      { status: 400 }
    );
  }

  const existing = await loadExperimentProgress();
  if (isProgressActivelyRunning(existing)) {
    return NextResponse.json(
      { error: "An experiment is already running — wait for it to finish or dismiss the progress bar." },
      { status: 409 }
    );
  }

  after(async () => {
    try {
      await runManualExperiment();
    } catch (err) {
      console.error("[experiment]", err);
    }
  });

  return NextResponse.json(
    {
      ok: true,
      started: true,
      experimentMode: manualExperimentMode(),
      llmProvider: llmExperimentProviderLabel(),
    },
    { status: 202 }
  );
}
