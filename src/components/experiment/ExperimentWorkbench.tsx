"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExperimentRun, GenerationRun } from "@/lib/schema/experiment";
import type { VisitIndex } from "@/lib/registry";
import type { PageVariant } from "@/lib/schema/page";
import { LandingPagesGrid } from "@/components/LandingPagesSidebar";
import {
  ExperimentDetailPanel,
  type DetailTab,
} from "@/components/experiment/ExperimentDetailPanel";

interface RunPayload {
  runVersion: number;
  variants: PageVariant[];
  index: VisitIndex;
  generations?: Array<
    Pick<
      GenerationRun,
      "generation" | "variantIds" | "totalVisits" | "metrics" | "decisions" | "allocationHistory"
    > & { report: { insights: string } }
  >;
}

function runFromPayload(
  initial: ExperimentRun | null,
  data: RunPayload
): ExperimentRun | null {
  if (!data.generations?.length) return initial;
  return {
    id: initial?.id ?? "live",
    createdAt: initial?.createdAt ?? new Date().toISOString(),
    personaSetVersion: initial?.personaSetVersion ?? 1,
    variants: data.variants,
    generations: data.generations.map((g) => ({
      ...g,
      visits: [],
      offspringIds: [],
      report: {
        generation: g.generation,
        insights: g.report.insights,
        findings: [],
        scorecards: [],
      },
    })),
  };
}

export function ExperimentWorkbench({
  initialRun,
  initialVariants,
  initialRunVersion,
  initialIndex,
}: {
  initialRun: ExperimentRun | null;
  initialVariants: PageVariant[];
  initialRunVersion: number;
  initialIndex: VisitIndex | null;
}) {
  const [run, setRun] = useState(initialRun);
  const [variants, setVariants] = useState(initialVariants);
  const [visitIndex, setVisitIndex] = useState(initialIndex);
  const [activeTab, setActiveTab] = useState<DetailTab>("method");
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/run");
      if (!res.ok) return;
      const data = (await res.json()) as RunPayload;
      setVariants(data.variants);
      setVisitIndex(data.index);
      setRun((prev) => runFromPayload(prev, data));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const handleSelectVariant = (variantId: string) => {
    setSelectedVariantId(variantId);
    setActiveTab("behavior");
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-100 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] xl:grid-cols-[minmax(0,1fr)_480px]">
      {/* Left: preview grid — unchanged card behavior */}
      <div className="border-b border-slate-200 lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Initial landing page versions
          </p>
          <LandingPagesGrid
            embedded
            initialVariants={initialVariants}
            initialRunVersion={initialRunVersion}
            selectedVariantId={selectedVariantId}
            onSelectVariant={handleSelectVariant}
          />
        </div>
      </div>

      {/* Right: experiment detail tabs */}
      <div className="flex min-h-[480px] flex-col bg-white lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)]">
        <ExperimentDetailPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          run={run}
          variants={variants}
          visitIndex={visitIndex}
          selectedVariantId={selectedVariantId}
        />
      </div>
    </div>
  );
}
