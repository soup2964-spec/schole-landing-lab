"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GENERATION_0 } from "@/config/variants";
import { staticReplicaPath } from "@/lib/replica/paths";
import type { PageVariant } from "@/lib/schema/page";
import { LandingPagePreview } from "@/components/LandingPagePreview";

const PREVIEWS_PER_PAGE = 3;

function PageTile({
  variant,
  selected,
  onSelect,
}: {
  variant: PageVariant;
  selected?: boolean;
  onSelect?: (variantId: string) => void;
}) {
  const src = staticReplicaPath(variant.id);
  const pageHref = `/v/${variant.id}`;

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${
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
        <LandingPagePreview src={src} title={variant.name} />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-slate-50 text-xs text-slate-400">
          {variant.id}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 border-t border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold leading-snug text-slate-900">{variant.name}</h2>
          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-600">
            {variant.thesis}
          </p>
        </div>
        <Link
          href={pageHref}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="mt-auto inline-flex w-full items-center justify-center rounded-lg bg-schole-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-schole-primary-hover"
        >
          View page
        </Link>
      </div>
    </article>
  );
}

function NavArrow({
  direction,
  disabled,
  onClick,
  label,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
        {direction === "left" ? (
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
            clipRule="evenodd"
          />
        ) : (
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
            clipRule="evenodd"
          />
        )}
      </svg>
    </button>
  );
}

function sortGen0(variants: PageVariant[]) {
  return [...variants]
    .filter((v) => v.generation === 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Full-page grid of Generation-0 landing page runs only. */
export function LandingPagesGrid({
  initialVariants,
  initialRunVersion = 0,
  embedded = false,
  selectedVariantId,
  onSelectVariant,
}: {
  initialVariants?: PageVariant[];
  initialRunVersion?: number;
  embedded?: boolean;
  selectedVariantId?: string | null;
  onSelectVariant?: (variantId: string) => void;
}) {
  const [variants, setVariants] = useState<PageVariant[]>(
    () => sortGen0(initialVariants ?? GENERATION_0)
  );
  const [runVersion, setRunVersion] = useState(initialRunVersion);
  const [previewPage, setPreviewPage] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/run");
      if (!res.ok) return;
      const data = (await res.json()) as { variants: PageVariant[]; runVersion: number };
      setVariants(sortGen0(data.variants));
      setRunVersion((prev) => {
        if (data.runVersion > prev) setPreviewPage(0);
        return data.runVersion;
      });
    } catch {
      /* ignore poll errors */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const pageCount = Math.max(1, Math.ceil(variants.length / PREVIEWS_PER_PAGE));

  useEffect(() => {
    setPreviewPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount]);

  const visibleVariants = useMemo(() => {
    const start = previewPage * PREVIEWS_PER_PAGE;
    return variants.slice(start, start + PREVIEWS_PER_PAGE);
  }, [previewPage, variants]);

  const experimentNumber = Math.max(1, runVersion + 1);
  const previewStart = previewPage * PREVIEWS_PER_PAGE + 1;
  const previewEnd = Math.min((previewPage + 1) * PREVIEWS_PER_PAGE, variants.length);

  const grid = (
    <div className="w-full max-w-5xl">
      <div className="grid grid-cols-3 gap-4">
        {visibleVariants.map((v) => (
          <PageTile
            key={v.id}
            variant={v}
            selected={selectedVariantId === v.id}
            onSelect={onSelectVariant}
          />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <NavArrow
          direction="left"
          disabled={previewPage === 0}
          onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
          label="Previous previews"
        />

        <div className="min-w-[10rem] text-center">
          <p className="text-sm font-semibold text-slate-900">Experiment {experimentNumber}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Previews {previewStart}–{previewEnd} of {variants.length}
          </p>
        </div>

        <NavArrow
          direction="right"
          disabled={previewPage >= pageCount - 1}
          onClick={() => setPreviewPage((p) => Math.min(pageCount - 1, p + 1))}
          label="Next previews"
        />
      </div>
    </div>
  );

  if (embedded) return grid;

  return <div className="min-h-screen bg-slate-100 p-6">{grid}</div>;
}

/** @deprecated */
export function LandingPagesSidebar({ compact }: { compact?: boolean }) {
  return <LandingPagesGrid />;
}
