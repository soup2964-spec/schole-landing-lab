import fs from "fs";
import path from "path";
import type { AllocationSnapshot, GenerationReport } from "@/lib/schema/experiment";
import type { Visit, VariantMetrics } from "@/lib/schema/events";
import type { PageVariant } from "@/lib/schema/page";
import type { VariantDecision } from "@/lib/stats/bayes";
import type { ExperimentProgressReporter } from "@/lib/loop/experiment-progress";
import { DEMO_PRELOAD_SEED } from "./demo-preload-constants";

export { DEMO_PRELOAD_SEED } from "./demo-preload-constants";

const PRELOAD_PATH = path.join(process.cwd(), "src", "config", "demo-preload-gen0.json");

export interface DemoPreloadSnapshot {
  version: 1;
  seed: number;
  pool: PageVariant[];
  metrics: VariantMetrics[];
  decisions: VariantDecision[];
  report: GenerationReport;
  visits: Visit[];
  allocationHistory: AllocationSnapshot[];
  totalReadings: number;
  totalVisits: number;
}

export function demoPreloadEnabled(): boolean {
  return process.env.DEMO_PRELOAD === "1";
}

export function loadDemoPreloadSnapshot(): DemoPreloadSnapshot {
  if (!fs.existsSync(PRELOAD_PATH)) {
    throw new Error("demo-preload-gen0.json is missing — run npm run prepare:demo-preload");
  }
  const snap = JSON.parse(fs.readFileSync(PRELOAD_PATH, "utf8")) as DemoPreloadSnapshot;
  if (snap.version !== 1 || snap.seed !== DEMO_PRELOAD_SEED) {
    throw new Error("demo-preload-gen0.json is missing or out of date — run npm run prepare:demo-preload");
  }
  return snap;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Brief progress replay so the demo still shows readings → sim → eval before breeding. */
export async function replayDemoPreloadProgress(
  progress: ExperimentProgressReporter | undefined,
  snapshot: DemoPreloadSnapshot
) {
  if (!progress) return;

  progress.setGeneration(0, snapshot.pool.length);
  progress.readingsStart(snapshot.totalReadings);

  const step = Math.max(1, Math.floor(snapshot.totalReadings / 8));
  for (let done = step; done < snapshot.totalReadings; done += step) {
    progress.readingsProgress(done, snapshot.totalReadings);
    await sleep(120);
  }
  progress.readingsProgress(snapshot.totalReadings, snapshot.totalReadings);
  await sleep(150);
  progress.readingsDone();

  await sleep(200);
  progress.simulating();
  await sleep(350);
  progress.evaluating();
  await sleep(250);
}
