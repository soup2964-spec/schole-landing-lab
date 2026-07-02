import fs from "fs";
import path from "path";
import type {
  ExperimentMode,
  ExperimentProgress,
  ExperimentStage,
} from "@/lib/schema/experiment-progress";
import type { PageVariant } from "@/lib/schema/page";

export type { ExperimentMode, ExperimentProgress, ExperimentStage };

const PROGRESS_PATH = path.join(process.cwd(), "data", "experiment-progress.json");

const IDLE: ExperimentProgress = {
  status: "idle",
  stage: "starting",
  mode: null,
  generation: 0,
  totalGenerations: 0,
  label: "Idle",
  detail: null,
  percent: 0,
  startedAt: null,
  updatedAt: null,
  error: null,
  bredVariants: [],
};

/** In-memory copy — kept in sync with disk for poll requests. */
let current: ExperimentProgress = { ...IDLE };

function persist(state: ExperimentProgress) {
  current = state;
  try {
    fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true });
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(state), "utf8");
  } catch {
    /* non-fatal */
  }
}

export function loadExperimentProgress(): ExperimentProgress {
  try {
    if (fs.existsSync(PROGRESS_PATH)) {
      current = { ...IDLE, ...JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8")) };
    }
  } catch {
    /* use memory */
  }
  return current;
}

export function clearExperimentProgress() {
  persist({ ...IDLE });
}

/** Weight readings vs eval/breed differently by mode. */
function stageWeights(mode: ExperimentMode) {
  if (mode === "full") {
    return { readings: 0.72, simulating: 0.03, evaluating: 0.1, breeding: 0.15 };
  }
  return { readings: 0.08, simulating: 0.07, evaluating: 0.25, breeding: 0.6 };
}

export class ExperimentProgressReporter {
  private mode: ExperimentMode;
  private totalGenerations: number;
  private genSpan: number;
  private postRunSpan: number;
  private gen = 0;
  private stage: ExperimentStage = "starting";
  private stageBase = 0;
  private stageSpan = 0;
  private startedAt: string;
  private bredVariants: PageVariant[] = [];

  constructor(mode: ExperimentMode, totalGenerations: number) {
    this.mode = mode;
    this.totalGenerations = totalGenerations;
    this.genSpan = 92 / Math.max(1, totalGenerations);
    this.postRunSpan = 8;
    this.startedAt = new Date().toISOString();
    this.publish("starting", 0, "Starting experiment…", null);
  }

  setGeneration(gen: number, poolSize: number) {
    this.gen = gen;
    this.stageBase = gen * this.genSpan;
    this.publish(
      "readings",
      this.stageBase,
      `Generation ${gen + 1} of ${this.totalGenerations}`,
      `${poolSize} variants in pool`
    );
  }

  readingsStart(total: number) {
    const w = stageWeights(this.mode);
    this.stageSpan = this.genSpan * w.readings;
    this.stage = "readings";
    const label =
      this.mode === "full"
        ? `LLM persona readings (${total})`
        : `Heuristic persona readings (${total})`;
    this.publish("readings", this.stageBase, label, "0% complete");
  }

  readingsProgress(done: number, total: number) {
    const frac = total > 0 ? done / total : 1;
    this.publish(
      "readings",
      this.stageBase + this.stageSpan * frac,
      this.mode === "full" ? "LLM persona readings" : "Heuristic persona readings",
      `${done} / ${total}`
    );
  }

  readingsDone() {
    this.simulating();
  }

  simulating() {
    const w = stageWeights(this.mode);
    this.stage = "simulating";
    this.stageBase += this.stageSpan;
    this.stageSpan = this.genSpan * w.simulating;
    this.publish(
      "simulating",
      this.stageBase + this.stageSpan * 0.5,
      "Simulating visitor traffic",
      "Thompson bandit · Monte Carlo visits"
    );
  }

  evaluating() {
    const w = stageWeights(this.mode);
    this.stageBase += this.stageSpan;
    this.stageSpan = this.genSpan * w.evaluating;
    this.stage = "evaluating";
    this.publish(
      "evaluating",
      this.stageBase + this.stageSpan * 0.2,
      "LLM evaluator analyzing results",
      `Generation ${this.gen + 1}`
    );
  }

  breedingStart(total: number) {
    const w = stageWeights(this.mode);
    this.stageBase += this.stageSpan;
    this.stageSpan = this.genSpan * w.breeding;
    this.stage = "breeding";
    this.publish(
      "breeding",
      this.stageBase,
      "LLM optimizer breeding new pages",
      `0 / ${total} offspring`
    );
  }

  breedingProgress(done: number, total: number) {
    const frac = total > 0 ? done / total : 1;
    this.publish(
      "breeding",
      this.stageBase + this.stageSpan * frac,
      "LLM optimizer breeding new pages",
      `${done} / ${total} offspring`
    );
  }

  addBredVariant(variant: PageVariant) {
    this.bredVariants = [...this.bredVariants, variant];
    persist({
      ...current,
      bredVariants: [...this.bredVariants],
      detail: `${this.bredVariants.length} page${this.bredVariants.length === 1 ? "" : "s"} ready`,
      updatedAt: new Date().toISOString(),
    });
  }

  saving(label: string) {
    this.stage = "saving";
    this.publish("saving", 94, label, null);
  }

  complete() {
    this.publish("done", 100, "Experiment complete", null, "complete");
  }

  fail(error: string) {
    persist({
      ...current,
      status: "error",
      stage: "error",
      label: "Experiment failed",
      detail: error,
      error,
      percent: current.percent,
      updatedAt: new Date().toISOString(),
    });
  }

  private publish(
    stage: ExperimentStage,
    percent: number,
    label: string,
    detail: string | null,
    status: ExperimentProgress["status"] = "running"
  ) {
    this.stage = stage;
    persist({
      status,
      stage,
      mode: this.mode,
      generation: this.gen,
      totalGenerations: this.totalGenerations,
      label,
      detail,
      percent: Math.min(100, Math.max(0, Math.round(percent))),
      startedAt: this.startedAt,
      updatedAt: new Date().toISOString(),
      error: null,
      bredVariants: [...this.bredVariants],
    });
  }
}
