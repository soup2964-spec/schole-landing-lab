"use client";

import Link from "next/link";
import { staticReplicaPath } from "@/lib/replica/paths";
import type { PageVariant } from "@/lib/schema/page";
import type { VariantJudgment } from "@/lib/judgment/criteria";
import { formatLiftPp } from "@/lib/judgment/criteria";
import { LandingPagePreview } from "@/components/LandingPagePreview";
import { DecisionChip } from "@/components/experiment/DecisionChip";

/** @deprecated Use VariantJudgment instead */
export type VariantMetrics = { conversionRate: number; fitness: number };

export function PageTile({
  variant,
  selected,
  onSelect,
  judgment,
  compact,
  uniformSize,
}: {
  variant: PageVariant;
  selected?: boolean;
  onSelect?: (variantId: string) => void;
  judgment?: VariantJudgment;
  compact?: boolean;
  /** Keeps preview + footer footprint identical across comparison grids. */
  uniformSize?: boolean;
}) {
  const src = staticReplicaPath(variant.id);
  const pageHref = `/v/${variant.id}`;

  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${
        selected ? "border-schole-primary ring-2 ring-schole-primary/20" : "border-slate-200"
      } ${onSelect ? "cursor-pointer" : ""}`}
      onClick={onSelect ? () => onSelect(variant.id) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(variant.id);
              }
            }
          : undefined
      }
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      {src ? (
        <LandingPagePreview src={src} title={variant.name} className="shrink-0" />
      ) : (
        <div className="flex aspect-[4/3] shrink-0 items-center justify-center bg-slate-50 text-xs text-slate-400">
          {variant.id}
        </div>
      )}
      <div
        className={`flex flex-col border-t border-slate-100 ${
          uniformSize
            ? "min-h-[7.75rem] flex-1 px-2 py-2"
            : `flex-1 flex-col gap-2 ${compact ? "px-2 py-2" : "px-4 py-3"}`
        }`}
      >
        <div className={uniformSize ? "flex min-h-0 flex-1 flex-col gap-1.5" : undefined}>
          <h2
            className={`font-semibold leading-snug text-slate-900 ${
              compact || uniformSize ? "line-clamp-1 text-xs" : "text-sm"
            }`}
          >
            {variant.name}
          </h2>
          {uniformSize ? (
            <div className="min-h-[3.25rem]">
              {judgment ? <JudgmentChips judgment={judgment} /> : null}
            </div>
          ) : judgment && compact ? (
            <JudgmentChips judgment={judgment} />
          ) : judgment ? (
            <div className="mt-2">
              <JudgmentChips judgment={judgment} />
            </div>
          ) : null}
          {!compact && !uniformSize && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">{variant.thesis}</p>
          )}
        </div>
        <Link
          href={pageHref}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex w-full shrink-0 items-center justify-center rounded-lg bg-schole-primary font-semibold text-white transition hover:bg-schole-primary-hover ${
            compact || uniformSize ? "mt-auto px-2 py-1.5 text-xs" : "mt-auto px-3 py-2 text-sm"
          }`}
        >
          View page
        </Link>
      </div>
    </article>
  );
}

function JudgmentChips({ judgment }: { judgment: VariantJudgment }) {
  return (
    <div className="flex flex-wrap gap-1">
      <span className="rounded-full bg-schole-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-schole-primary">
        {(judgment.conversionRate * 100).toFixed(1)}%
      </span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
          judgment.liftPp !== null && judgment.liftPp > 0
            ? "bg-emerald-100 text-emerald-800"
            : judgment.liftPp !== null && judgment.liftPp < 0
              ? "bg-rose-50 text-rose-700"
              : "bg-slate-100 text-slate-600"
        }`}
      >
        {formatLiftPp(judgment.liftPp)}
      </span>
      {judgment.status && (
        <span className="inline-flex items-center gap-0.5">
          {judgment.pBest !== null && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              P(best) {(judgment.pBest * 100).toFixed(0)}%
            </span>
          )}
          <DecisionChip decision={{ status: judgment.status }} />
        </span>
      )}
      {judgment.bestPersona && (
        <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
          Best: {judgment.bestPersona.name}
        </span>
      )}
    </div>
  );
}

/** 3×3 grid showing up to nine variant preview tiles. */
export function NineVariantGrid({
  variants,
  judgmentsByVariant,
  selectedVariantId,
  onSelectVariant,
  compact,
  uniformSize,
  slotCount = 9,
}: {
  variants: PageVariant[];
  judgmentsByVariant?: Record<string, VariantJudgment>;
  selectedVariantId?: string | null;
  onSelectVariant?: (variantId: string) => void;
  compact?: boolean;
  uniformSize?: boolean;
  slotCount?: number;
}) {
  const slots = Array.from({ length: 9 }, (_, i) => variants[i] ?? null);

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-3">
      {slots.map((variant, i) =>
        variant ? (
          <PageTile
            key={variant.id}
            variant={variant}
            selected={selectedVariantId === variant.id}
            onSelect={onSelectVariant}
            judgment={judgmentsByVariant?.[variant.id]}
            compact={compact}
            uniformSize={uniformSize}
          />
        ) : (
          <EmptyComparisonSlot key={`empty-${i}`} uniformSize={uniformSize} />
        )
      )}
    </div>
  );
}

function EmptyComparisonSlot({ uniformSize }: { uniformSize?: boolean }) {
  if (uniformSize) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
        <div className="aspect-[4/3] w-full shrink-0" />
        <div className="min-h-[7.75rem] flex-1 border-t border-slate-100" />
      </div>
    );
  }

  return (
    <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50" />
  );
}
