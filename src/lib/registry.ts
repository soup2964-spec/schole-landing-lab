import { GENERATION_0 } from "@/config/variants";
import { POSTHOG_EVENTS } from "@/lib/analytics/posthog-events";
import type { DeployState } from "@/lib/deploy/state";
import {
  getLabDocument,
  getLabDocumentSync,
  LAB_DOC,
  listExperimentNumbers,
  setLabDocument,
} from "@/lib/supabase/lab-documents";
import type { ExperimentRun } from "@/lib/schema/experiment";
import type { ExperimentProgress } from "@/lib/schema/experiment-progress";
import type { PageVariant } from "@/lib/schema/page";
import { compactRunForStorage } from "@/lib/evolve/compact-run";

let cachedRun: ExperimentRun | null | undefined;

export async function loadRun(): Promise<ExperimentRun | null> {
  if (cachedRun !== undefined) return cachedRun;
  cachedRun = await getLabDocument<ExperimentRun>(LAB_DOC.ACTIVE_RUN);
  return cachedRun;
}

export function loadRunSync(): ExperimentRun | null {
  return getLabDocumentSync<ExperimentRun>(LAB_DOC.ACTIVE_RUN);
}

export async function saveRun(run: ExperimentRun) {
  cachedRun = run;
  await setLabDocument(LAB_DOC.ACTIVE_RUN, compactRunForStorage(run));
}

export function invalidateRunCache() {
  cachedRun = undefined;
}

function deploySnapshotSync(): DeployState | null {
  return getLabDocumentSync<DeployState>(LAB_DOC.DEPLOY_STATE);
}

export function getGen0Variants(): PageVariant[] {
  const deploy = deploySnapshotSync();
  return deploy?.currentVariants?.length ? deploy.currentVariants : GENERATION_0;
}

export function getProductionVariant(): PageVariant | null {
  const deploy = deploySnapshotSync();
  if (!deploy || deploy.deployVersion === 0) return null;
  const baseline = deploy.currentVariants.find((v) => v.id === "v0-baseline");
  if (!baseline) return null;
  return {
    ...baseline,
    id: "production",
    name: "Production (auto-deployed winner)",
    strategy: "baseline",
  };
}

export async function allVariants(): Promise<PageVariant[]> {
  const run = await loadRun();
  const gen0 = getGen0Variants();
  const gen0Ids = new Set(gen0.map((v) => v.id));
  const bred = run?.variants.filter((v) => !gen0Ids.has(v.id)) ?? [];
  const production = getProductionVariant();
  return [...gen0, ...bred, ...(production ? [production] : [])];
}

export function allVariantsSync(): PageVariant[] {
  const run = loadRunSync();
  const gen0 = getGen0Variants();
  const gen0Ids = new Set(gen0.map((v) => v.id));
  const bred = run?.variants.filter((v) => !gen0Ids.has(v.id)) ?? [];
  const production = getProductionVariant();
  return [...gen0, ...bred, ...(production ? [production] : [])];
}

export async function getVariant(id: string): Promise<PageVariant | undefined> {
  return findVariant(id);
}

/** Resolve a variant from active run, deploy state, or saved experiment snapshots. */
export async function findVariant(id: string): Promise<PageVariant | undefined> {
  if (id === "production") return getProductionVariant() ?? undefined;

  const variants = await allVariants();
  const fromActive = variants.find((v) => v.id === id);
  if (fromActive) return fromActive;

  const progress = await getLabDocument<ExperimentProgress>(LAB_DOC.EXPERIMENT_PROGRESS);
  const fromProgress = progress?.bredVariants?.find((v) => v.id === id);
  if (fromProgress) return fromProgress;

  const numbers = await listExperimentNumbers();
  for (let i = numbers.length - 1; i >= 0; i--) {
    const run = await getLabDocument<ExperimentRun>(LAB_DOC.experiment(numbers[i]!));
    const found = run?.variants.find((v) => v.id === id);
    if (found) return found;
  }

  return undefined;
}

export async function getVisit(generation: number, visitId: string) {
  const run = await loadRun();
  return run?.generations[generation]?.visits.find((v) => v.id === visitId);
}

export interface VisitSummary {
  id: string;
  personaId: string;
  variantId: string;
  converted: boolean;
  bounced: boolean;
  scrollDepth: number;
  totalDwellMs: number;
  verdictPreview: string;
  path: { sectionId: string; action: "read" | "skim" | "bounce" }[];
}

export function visitIndex(run: ExperimentRun) {
  return run.generations.map((g) => ({
    generation: g.generation,
    totalVisits: g.totalVisits ?? g.visits.length,
    variantIds: g.variantIds,
    metrics: g.metrics,
    visits: g.visits.map((v) => ({
      id: v.id,
      personaId: v.personaId,
      variantId: v.variantId,
      converted: v.converted,
      bounced: v.events.some(
        (e) => e.type === POSTHOG_EVENTS.PAGE_EXIT && e.bounced === true
      ),
      scrollDepth: v.scrollDepth,
      totalDwellMs: v.totalDwellMs,
      verdictPreview: v.verdict.slice(0, 140),
      path: v.events
        .filter(
          (e): e is typeof e & { sectionId: string } =>
            !!e.sectionId && e.type === POSTHOG_EVENTS.SECTION_ENGAGED
        )
        .map((e) => ({
          sectionId: e.sectionId,
          action: (e.engagement === "read" ? "read" : e.engagement === "skim" ? "skim" : "bounce") as
            | "read"
            | "skim"
            | "bounce",
        })),
    })) satisfies VisitSummary[],
  }));
}

export type VisitIndex = ReturnType<typeof visitIndex>;
