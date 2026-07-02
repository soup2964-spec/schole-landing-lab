import { NextResponse } from "next/server";
import { getLoopStatus, maybeAutoSync, syncLoop } from "@/lib/loop/sync";
import { recordHeartbeat } from "@/lib/loop/state";

export async function GET() {
  const autoResult = await maybeAutoSync();
  const status = await getLoopStatus();
  return NextResponse.json({
    status,
    autoSync: autoResult,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const force = body.force === true;
  const result = await syncLoop(force);
  const status = await getLoopStatus();
  return NextResponse.json({ result, status });
}
