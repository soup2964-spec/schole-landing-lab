"use client";

import type { PageVariant } from "@/shared/schema/page";
import { BRED_GRID_SIZE } from "@/lab/comparison/snapshots";
import { NineVariantGrid } from "@/ui/workbench/PageTile";

function ComparisonSection({
  label,
  title,
  experimentNumber,
  variants,
  emptyMessage,
  slotCount = BRED_GRID_SIZE,
  selectedVariantId,
  onSelectVariant,
}: {
  label?: string;
  title?: string;
  experimentNumber?: number;
  variants: PageVariant[];
  emptyMessage?: string;
  slotCount?: number;
  selectedVariantId?: string | null;
  onSelectVariant?: (variantId: string) => void;
}) {
  const hasAny = variants.length > 0;
  const heading =
    title ?? (experimentNumber != null ? `Experiment ${experimentNumber}` : label ?? "");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 border-b border-slate-100 pb-3">
        {label && title ? (
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
        ) : null}
        <h2 className={`font-semibold text-slate-900 ${label && title ? "mt-1 text-lg" : "text-lg"}`}>
          {heading}
        </h2>
      </div>

      {hasAny ? (
        <NineVariantGrid
          variants={variants}
          compact
          uniformSize
          slotCount={slotCount}
          selectedVariantId={selectedVariantId}
          onSelectVariant={onSelectVariant}
        />
      ) : (
        <div className="grid grid-cols-3 grid-rows-2 gap-3">
          {Array.from({ length: slotCount }, (_, i) => (
            <div
              key={`empty-${i}`}
              className="flex h-full flex-col overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50/50"
            >
              <div className="aspect-[4/3] w-full shrink-0" />
              <div className="flex min-h-[7.75rem] flex-1 items-center justify-center border-t border-slate-100 px-2 text-center text-xs text-slate-400">
                {i === 4 ? (emptyMessage ?? "No pages yet") : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function PageComparisonView({
  experimentNumber,
  previousVariants,
  currentVariants,
  selectedVariantId,
  onSelectVariant,
  isRunning,
}: {
  experimentNumber: number;
  previousVariants: PageVariant[];
  currentVariants: PageVariant[];
  selectedVariantId?: string | null;
  onSelectVariant?: (variantId: string) => void;
  isRunning?: boolean;
}) {
  const previousNumber = Math.max(1, experimentNumber - 1);
  const modeLabel = "Heuristic persona readings";

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        Viewing Experiment {experimentNumber} · {modeLabel} · click a page to highlight it across
        behavior and winners tabs
      </p>
      <div className="grid gap-6 xl:grid-cols-2">
      <ComparisonSection
        title={experimentNumber === 1 ? "Base" : undefined}
        label={experimentNumber === 1 ? undefined : "Previous experiment"}
        experimentNumber={experimentNumber === 1 ? undefined : previousNumber}
        variants={previousVariants}
        selectedVariantId={selectedVariantId}
        onSelectVariant={onSelectVariant}
        emptyMessage={
          experimentNumber === 1 ? undefined : "No previous experiment — this is Experiment 1."
        }
      />

      <ComparisonSection
        label="Current experiment results"
        experimentNumber={experimentNumber}
        variants={currentVariants}
        selectedVariantId={selectedVariantId}
        onSelectVariant={onSelectVariant}
        emptyMessage={
          isRunning
            ? "New pages appear here as the optimizer finishes…"
            : "Run an experiment to breed new landing pages."
        }
      />
      </div>
    </div>
  );
}
