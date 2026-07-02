export type ExperimentStage =
  | "starting"
  | "readings"
  | "simulating"
  | "evaluating"
  | "breeding"
  | "saving"
  | "done"
  | "error";

export type ExperimentMode = "hybrid" | "full";

export interface ExperimentProgress {
  status: "idle" | "running" | "complete" | "error";
  stage: ExperimentStage;
  mode: ExperimentMode | null;
  generation: number;
  totalGenerations: number;
  label: string;
  detail: string | null;
  percent: number;
  startedAt: string | null;
  updatedAt: string | null;
  error: string | null;
  /** Bred pages revealed so far during the active run (for page comparison grid). */
  bredVariants?: import("@/lib/schema/page").PageVariant[];
}
