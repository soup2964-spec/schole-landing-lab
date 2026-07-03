import { after, NextResponse } from "next/server";
import {
  isLlmExperimentAvailable,
  llmExperimentProviderLabel,
  manualExperimentMode,
  runManualExperiment,
} from "@/lib/loop/manual-experiment";
import { isProgressActivelyRunning, loadExperimentProgress } from "@/lib/loop/experiment-progress";
import { isAutonomousMode, loadLoopState, saveLoopState } from "@/lib/loop/state";
import { demoPreloadEnabled } from "@/lib/evolve/demo-preload";

/** Background experiment via after() — Hobby plan caps at 300s. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET() {
  const state = await loadLoopState();
  return NextResponse.json({
    autonomous: isAutonomousMode(state),
    llmPersonas: Boolean(state.llmPersonas),
    runVersion: state.runVersion,
    lastRunId: state.lastRunId,
    lastSyncAt: state.lastSyncAt,
    experimentMode: manualExperimentMode(state),
    llmExperimentAvailable: isLlmExperimentAvailable(),
    llmProvider: llmExperimentProviderLabel(),
    demoPreload: demoPreloadEnabled(),
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    autonomous?: boolean;
    llmPersonas?: boolean;
  };

  if (typeof body.autonomous !== "boolean" && typeof body.llmPersonas !== "boolean") {
    return NextResponse.json(
      { error: "Provide autonomous and/or llmPersonas (boolean)" },
      { status: 400 }
    );
  }

  const state = await loadLoopState();
  const next = {
    ...state,
    ...(typeof body.autonomous === "boolean" ? { autonomous: body.autonomous } : {}),
    ...(typeof body.llmPersonas === "boolean" ? { llmPersonas: body.llmPersonas } : {}),
  };
  await saveLoopState(next);

  return NextResponse.json({
    autonomous: next.autonomous,
    llmPersonas: next.llmPersonas,
    experimentMode: manualExperimentMode(next),
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
      experimentMode: manualExperimentMode(state),
      llmProvider: llmExperimentProviderLabel(),
    },
    { status: 202 }
  );
}
