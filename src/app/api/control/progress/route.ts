import { NextResponse } from "next/server";
import { loadExperimentProgress } from "@/lib/loop/experiment-progress";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(loadExperimentProgress());
}
