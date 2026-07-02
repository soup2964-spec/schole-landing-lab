"use client";

import type { PageVariant } from "@/lib/schema/page";
import type { VariantJudgment } from "@/lib/judgment/criteria";
import { BRED_GRID_SIZE } from "@/lib/comparison/snapshots";
import { NineVariantGrid } from "@/components/experiment/PageTile";
import { JudgmentPanel } from "@/components/experiment/JudgmentPanel";

export type ExperimentSnapshot = {
  experimentNumber: number;
  variants: PageVariant[];
  judgmentsByVariant: Record<string, VariantJudgment>;
};

function ComparisonSection({
  label,
  title,
  experimentNumber,
  variants,
  judgmentsByVariant,
  showJudgment,
  selectedVariantId,
  onSelectVariant,
  emptyMessage,
  slotCount = BRED_GRID_SIZE,
}: {
  label?: string;
  title?: string;
  experimentNumber?: number;
  variants: PageVariant[];
  judgmentsByVariant?: Record<string, VariantJudgment>;
  showJudgment?: boolean;
  selectedVariantId?: string | null;
  onSelectVariant?: (variantId: string) => void;
  emptyMessage?: string;
  slotCount?: number;
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
          judgmentsByVariant={showJudgment ? judgmentsByVariant : undefined}
          selectedVariantId={selectedVariantId}
          onSelectVariant={onSelectVariant}
          compact
          uniformSize
          slotCount={slotCount}
        />
      ) : (
        <div className="grid grid-cols-3 grid-rows-3 gap-3">
          {Array.from({ length: 9 }, (_, i) => (
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
  judgmentsByVariant = {},
  selectedVariantId,
  onSelectVariant,
  onViewBehavior,
  isRunning,
}: {
  experimentNumber: number;
  previousVariants: PageVariant[];
  currentVariants: PageVariant[];
  judgmentsByVariant?: Record<string, VariantJudgment>;
  selectedVariantId?: string | null;
  onSelectVariant?: (variantId: string) => void;
  onViewBehavior?: (variantId: string) => void;
  isRunning?: boolean;
}) {
  const previousNumber = Math.max(1, experimentNumber - 1);
  const selectedVariant = currentVariants.find((v) => v.id === selectedVariantId);
  const selectedJudgment =
    selectedVariantId && judgmentsByVariant[selectedVariantId];

  return (
    <div className="space-y-6">
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
          judgmentsByVariant={judgmentsByVariant}
          showJudgment={currentVariants.length > 0}
          selectedVariantId={selectedVariantId}
          onSelectVariant={onSelectVariant}
          emptyMessage={
            isRunning
              ? "New pages appear here as the optimizer finishes…"
              : "Run an experiment to breed new landing pages."
          }
        />
      </div>

      {selectedVariant && selectedJudgment && (
        <JudgmentPanel
          variant={selectedVariant}
          judgment={selectedJudgment}
          onViewBehavior={
            onViewBehavior ? () => onViewBehavior(selectedVariant.id) : undefined
          }
        />
      )}
    </div>
  );
}

export function snapshotFromRun(
  experimentNumber: number,
  variants: PageVariant[],
  judgmentsByVariant: Record<string, VariantJudgment> = {}
): ExperimentSnapshot {
  return { experimentNumber, variants, judgmentsByVariant };
}
