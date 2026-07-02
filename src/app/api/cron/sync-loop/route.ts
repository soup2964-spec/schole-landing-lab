import { NextResponse } from "next/server";
import { maybeAutoSync } from "@/lib/loop/sync";

/** Vercel Cron — polls for new traffic and runs the loop when thresholds are met. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await maybeAutoSync();
  return NextResponse.json({
    ok: true,
    synced: result?.synced ?? false,
    reason: result?.reason ?? "Threshold not met",
  });
}
