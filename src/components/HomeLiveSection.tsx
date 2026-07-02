"use client";

import { LiveLoopPanel } from "@/components/LiveLoopPanel";
import { CalibrationPanel } from "@/components/CalibrationPanel";
import type { SimulatedMetricsSnapshot } from "@/lib/calibration/types";

export function HomeLiveSection({
  simulated,
}: {
  simulated?: SimulatedMetricsSnapshot;
}) {
  return (
    <div className="mt-10 space-y-6">
      <LiveLoopPanel />
      <CalibrationPanel simulated={simulated} />
    </div>
  );
}
