import fs from "fs";
import path from "path";
import { GENERATION_0 } from "@/config/variants";
import { removeBredVariantHtml } from "@/lab/deploy/write-html";
import { saveDeployState } from "@/lab/deploy/state";
import { resetExperimentProgress } from "@/lab/live-loop/experiment-progress";
import { invalidateLoopCache, loadLoopState, saveLoopState } from "@/lab/live-loop/state";
import { labFsWritable } from "@/shared/fs/lab-fs";
import { invalidateRunCache } from "@/shared/registry";
import {
  invalidateLabDocumentCache,
  LAB_DOC,
  listExperimentNumbers,
} from "@/shared/db/lab-documents";
import { getSupabaseAdmin } from "@/shared/db/server";

export interface ResetLabResult {
  removedHtml: string[];
}

function rmIfExists(p: string) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function clearLocalExperimentFiles() {
  if (!labFsWritable()) return;

  const expDir = path.join(process.cwd(), "data", "experiments");
  if (fs.existsSync(expDir)) {
    for (const f of fs.readdirSync(expDir)) {
      if (f.endsWith(".json")) rmIfExists(path.join(expDir, f));
    }
  }
}

async function deleteRemoteExperimentDocs() {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const numbers = await listExperimentNumbers();
  const ids = [
    ...numbers.map((n) => LAB_DOC.experiment(n)),
    LAB_DOC.ACTIVE_RUN,
  ];
  if (ids.length) {
    const { error } = await sb.from("lab_documents").delete().in("id", ids);
    if (error) throw new Error(`lab_documents delete: ${error.message}`);
  }
}

async function deleteActiveRunLocally() {
  if (!labFsWritable()) return;
  rmIfExists(path.join(process.cwd(), "data", "run.json"));
}

/** Reset experiment history, bred pages, and active run — keeps gen-0 base pages. */
export async function resetLabState(): Promise<ResetLabResult> {
  const loop = await loadLoopState();

  await deleteRemoteExperimentDocs();
  clearLocalExperimentFiles();
  await deleteActiveRunLocally();

  await saveLoopState({
    autonomous: loop.autonomous,
    llmPersonas: false,
    runVersion: loop.runVersion,
    lastSyncAt: null,
    lastVisitorCount: 0,
    heartbeatVisits: loop.heartbeatVisits,
    lastCalibrationVersion: loop.lastCalibrationVersion,
    lastRunId: null,
    syncHistory: [],
    experimentHistory: [],
  });

  await saveDeployState({
    deployVersion: 0,
    lastPromotedAt: null,
    lastPromotedVariantId: null,
    previousVariants: [...GENERATION_0],
    currentVariants: [...GENERATION_0],
    htmlVariantIds: GENERATION_0.map((v) => v.id),
    history: [],
  });

  await resetExperimentProgress();
  invalidateRunCache();

  const removedHtml = removeBredVariantHtml();

  invalidateLoopCache();
  invalidateLabDocumentCache();

  return { removedHtml };
}
