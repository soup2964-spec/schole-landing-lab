export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resetLabState } from "@/lib/lab/reset-lab";
import { isProgressActivelyRunning, loadExperimentProgress } from "@/lib/loop/experiment-progress";
import { isAutonomousMode, loadLoopState } from "@/lib/loop/state";

export async function POST() {
  const state = await loadLoopState();
  if (isAutonomousMode(state)) {
    return NextResponse.json(
      { error: "Turn off Autonomous mode before resetting the lab." },
      { status: 400 }
    );
  }

  const progress = await loadExperimentProgress();
  if (isProgressActivelyRunning(progress)) {
    return NextResponse.json(
      { error: "Wait for the current experiment to finish before resetting." },
      { status: 409 }
    );
  }

  try {
    const result = await resetLabState();
    return NextResponse.json({
      ok: true,
      removedPages: result.removedHtml.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lab reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
