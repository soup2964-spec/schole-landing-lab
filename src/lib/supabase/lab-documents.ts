import fs from "fs";
import path from "path";
import { labFsWritable } from "@/lib/lab-fs";
import { getSupabaseAdmin, supabaseConfigured } from "./server";

/** Singleton docs and experiment snapshots — all persisted under lab_documents. */
export const LAB_DOC = {
  ACTIVE_RUN: "active_run",
  LOOP_STATE: "loop_state",
  DEPLOY_STATE: "deploy_state",
  CALIBRATION: "calibration",
  EXPERIMENT_PROGRESS: "experiment_progress",
  experiment: (n: number) => `experiment:${n}`,
} as const;

const FS_PATHS: Record<string, string> = {
  [LAB_DOC.ACTIVE_RUN]: "data/run.json",
  [LAB_DOC.LOOP_STATE]: "data/loop-state.json",
  [LAB_DOC.DEPLOY_STATE]: "data/deploy-state.json",
  [LAB_DOC.CALIBRATION]: "data/calibration.json",
  [LAB_DOC.EXPERIMENT_PROGRESS]: "data/experiment-progress.json",
};

function fsPathForId(id: string): string | null {
  if (FS_PATHS[id]) return FS_PATHS[id];
  const m = /^experiment:(\d+)$/.exec(id);
  if (m) return `data/experiments/experiment-${m[1]}.json`;
  return null;
}

export function labDocumentsEnabled(): boolean {
  return supabaseConfigured();
}

/** In-memory read cache — reduces Supabase disk IO on hot docs. */
const CACHE_TTL_MS = 60_000;
const docCache = new Map<string, { value: unknown; expiresAt: number }>();

export function invalidateLabDocumentCache(id?: string) {
  if (id) {
    docCache.delete(id);
    return;
  }
  docCache.clear();
}

function readCached<T>(id: string): T | null | undefined {
  const hit = docCache.get(id);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    docCache.delete(id);
    return undefined;
  }
  return hit.value as T;
}

function writeCached<T>(id: string, value: T) {
  docCache.set(id, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function readFs<T>(id: string): T | null {
  const rel = fsPathForId(id);
  if (!rel) return null;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeFs<T>(id: string, doc: T) {
  const rel = fsPathForId(id);
  if (!rel) return;
  const full = path.join(process.cwd(), rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(doc, null, 2), "utf8");
}

export async function getLabDocument<T>(id: string): Promise<T | null> {
  const cached = readCached<T>(id);
  if (cached !== undefined) return cached;

  const sb = getSupabaseAdmin();
  if (sb) {
    const { data, error } = await sb
      .from("lab_documents")
      .select("doc")
      .eq("id", id)
      .maybeSingle();
    if (!error && data?.doc != null) {
      writeCached(id, data.doc);
      return data.doc as T;
    }
  }
  const fromFs = readFs<T>(id);
  if (fromFs != null) writeCached(id, fromFs);
  return fromFs;
}

export async function setLabDocument<T>(id: string, doc: T): Promise<void> {
  writeCached(id, doc);
  const sb = getSupabaseAdmin();
  if (sb) {
    const { error } = await sb.from("lab_documents").upsert({
      id,
      doc: doc as object,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      invalidateLabDocumentCache(id);
      throw new Error(`lab_documents upsert failed (${id}): ${error.message}`);
    }
  }
  if (labFsWritable()) writeFs(id, doc);
}

/** Sync read — filesystem only (build scripts / static generation). */
export function getLabDocumentSync<T>(id: string): T | null {
  return readFs<T>(id);
}

function listExperimentNumbersFs(): number[] {
  const dir = path.join(process.cwd(), "data/experiments");
  try {
    return fs
      .readdirSync(dir)
      .map((file) => /^experiment-(\d+)\.json$/.exec(file)?.[1])
      .filter((n): n is string => Boolean(n))
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/** List saved experiment:N document ids without loading full JSON payloads. */
export async function listExperimentNumbers(): Promise<number[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    const { data, error } = await sb
      .from("lab_documents")
      .select("id")
      .like("id", "experiment:%");
    if (!error && data?.length) {
      return data
        .map((row) => Number(/^experiment:(\d+)$/.exec(row.id)?.[1]))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
    }
  }
  return listExperimentNumbersFs();
}
