import { NextResponse } from "next/server";
import { recordHeartbeat } from "@/lib/loop/state";
import { maybeAutoSync } from "@/lib/loop/sync";

/** Called once per browser session when a visitor lands on a variant page. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const count = recordHeartbeat();

  let autoSync = null;
  try {
    autoSync = await maybeAutoSync();
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    ok: true,
    heartbeatVisits: count,
    variantId: body.variantId ?? null,
    autoSync,
  });
}
