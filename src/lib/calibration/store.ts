import fs from "fs";
import path from "path";
import type { CalibrationRecord } from "./types";
import type { Persona, PersonaSet } from "@/lib/schema/persona";
import { PERSONA_SET_V1 } from "@/config/personas";

const CALIBRATION_PATH = path.join(process.cwd(), "data", "calibration.json");

export function loadCalibration(): CalibrationRecord | null {
  try {
    const raw = fs.readFileSync(CALIBRATION_PATH, "utf8");
    return JSON.parse(raw) as CalibrationRecord;
  } catch {
    return null;
  }
}

export function saveCalibration(record: CalibrationRecord) {
  fs.mkdirSync(path.dirname(CALIBRATION_PATH), { recursive: true });
  fs.writeFileSync(CALIBRATION_PATH, JSON.stringify(record, null, 2), "utf8");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Apply stored calibration adjustments to the base persona set. */
export function getCalibratedPersonaSet(base: PersonaSet = PERSONA_SET_V1): PersonaSet {
  const cal = loadCalibration();
  if (!cal) return base;

  const { adjustments } = cal;
  const personas: Persona[] = base.personas.map((p) => ({
    ...p,
    ctaPropensity: clamp(
      p.ctaPropensity * adjustments.ctaPropensityMultiplier,
      0.05,
      0.95
    ),
    patienceSeconds: {
      ...p.patienceSeconds,
      mean: clamp(p.patienceSeconds.mean + adjustments.patienceSecondsDelta, 20, 180),
    },
    skimPropensity: clamp(p.skimPropensity + adjustments.skimPropensityDelta, 0.05, 0.95),
  }));

  return {
    version: base.version + cal.version,
    createdAt: cal.createdAt,
    changelog: cal.changelog,
    personas,
  };
}
