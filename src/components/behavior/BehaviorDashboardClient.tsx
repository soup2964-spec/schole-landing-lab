"use client";

import { useCallback, useEffect, useState } from "react";
import { BehaviorDashboard } from "@/components/behavior/BehaviorDashboard";
import { LiveLoopPanel } from "@/components/LiveLoopPanel";
import { EmptyRun } from "@/components/Nav";
import type { VisitIndex } from "@/lib/registry";
import type { PageVariant } from "@/lib/schema/page";

interface RunPayload {
  runVersion: number;
  index: VisitIndex;
  variants: PageVariant[];
}

export function BehaviorDashboardClient({
  initialIndex,
  initialVariants,
}: {
  initialIndex: VisitIndex | null;
  initialVariants: PageVariant[];
}) {
  const [runVersion, setRunVersion] = useState(0);
  const [index, setIndex] = useState<VisitIndex | null>(initialIndex);
  const [variants, setVariants] = useState<PageVariant[]>(initialVariants);
  const [loading, setLoading] = useState(false);

  const refreshRun = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/run");
      if (!res.ok) return;
      const data = (await res.json()) as RunPayload;
      setIndex(data.index);
      setRunVersion(data.runVersion);
      setVariants(data.variants);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRun();
    const t = setInterval(refreshRun, 30_000);
    return () => clearInterval(t);
  }, [refreshRun]);

  if (!index) return <EmptyRun />;

  return (
    <div className="space-y-8">
      <LiveLoopPanel onUpdate={() => refreshRun()} />
      {loading && (
        <p className="text-center text-xs text-indigo-400/80">Refreshing simulation data…</p>
      )}
      <BehaviorDashboard key={runVersion} index={index} variants={variants} />
    </div>
  );
}
