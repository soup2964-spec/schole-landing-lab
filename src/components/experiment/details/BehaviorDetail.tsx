"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PERSONA_SET_V1 } from "@/config/personas";
import { ScrollDepthBar, VisitPathStrip } from "@/components/behavior/VisitVisuals";
import type { VisitIndex } from "@/lib/registry";
import type { Visit } from "@/lib/schema/events";
import type { PageVariant } from "@/lib/schema/page";
import { variantPageTitle } from "@/lib/variants/display-name";

type OutcomeFilter = "all" | "converted" | "lost" | "bounced";

export function BehaviorDetail({
  index,
  variants,
  selectedVariantId,
}: {
  index: VisitIndex | null;
  variants: PageVariant[];
  selectedVariantId?: string | null;
}) {
  const [genIdx, setGenIdx] = useState(Math.max(0, (index?.length ?? 1) - 1));
  const [variantId, setVariantId] = useState(selectedVariantId ?? index?.[0]?.variantIds[0] ?? "");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);

  useEffect(() => {
    if (selectedVariantId) setVariantId(selectedVariantId);
  }, [selectedVariantId]);

  const gen = index?.[genIdx];
  const variant = variants.find((v) => v.id === variantId);

  const filtered = useMemo(() => {
    let list = gen?.visits.filter((v) => v.variantId === variantId) ?? [];
    if (outcomeFilter === "converted") list = list.filter((v) => v.converted);
    if (outcomeFilter === "lost") list = list.filter((v) => !v.converted && !v.bounced);
    if (outcomeFilter === "bounced") list = list.filter((v) => v.bounced);
    return list;
  }, [gen, variantId, outcomeFilter]);

  const fetchVisit = useCallback(async (id: string, generation: number) => {
    try {
      const res = await fetch(`/api/visits/${encodeURIComponent(id)}?gen=${generation}`);
      if (!res.ok) return;
      setVisit((await res.json()) as Visit);
    } catch {
      setVisit(null);
    }
  }, []);

  useEffect(() => {
    if (!filtered.length || !gen) {
      setSelectedId(null);
      setVisit(null);
      return;
    }
    const pick = filtered.find((v) => v.id === selectedId) ?? filtered[0];
    if (pick.id !== selectedId) setSelectedId(pick.id);
    fetchVisit(pick.id, gen.generation);
  }, [filtered, selectedId, gen, fetchVisit]);

  if (!index?.length) {
    return <p className="text-sm text-slate-500">Run an experiment from the Control tab to populate behavior data.</p>;
  }

  const selected = filtered.find((v) => v.id === selectedId);
  const persona = PERSONA_SET_V1.personas.find((p) => p.id === selected?.personaId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={String(genIdx)}
          onChange={(e) => {
            const idx = Number(e.target.value);
            setGenIdx(idx);
            setVariantId(index[idx].variantIds[0]);
            setSelectedId(null);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
        >
          {index.map((g, i) => (
            <option key={g.generation} value={i}>
              Gen {g.generation} · {(g.totalVisits ?? g.visits.length).toLocaleString()} visits
            </option>
          ))}
        </select>
        <select
          value={variantId}
          onChange={(e) => {
            setVariantId(e.target.value);
            setSelectedId(null);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
        >
          {(gen?.variantIds ?? []).map((id) => {
            const v = variants.find((x) => x.id === id);
            return (
              <option key={id} value={id}>
                {v ? variantPageTitle(v) : id}
              </option>
            );
          })}
        </select>
        {(["all", "converted", "lost", "bounced"] as OutcomeFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setOutcomeFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              outcomeFilter === f
                ? "bg-schole-primary text-white"
                : "bg-slate-100 text-slate-600 hover:text-slate-900"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {selected && variant && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">{persona?.name ?? selected.personaId}</p>
              <p className="text-xs text-slate-500">{variantPageTitle(variant)}</p>
            </div>
            <OutcomeBadge converted={selected.converted} bounced={selected.bounced} />
          </div>
          <div className="mt-3">
            <ScrollDepthBar depth={selected.scrollDepth} />
          </div>
          <div className="mt-3">
            <VisitPathStrip path={selected.path} sections={variant.sections} compact />
          </div>
          {visit && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600 italic">
              &ldquo;{visit.verdict.slice(0, 280)}{visit.verdict.length > 280 ? "…" : ""}&rdquo;
            </p>
          )}
        </div>
      )}

      <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
        {filtered.slice(0, 20).map((v) => {
          const p = PERSONA_SET_V1.personas.find((x) => x.id === v.personaId);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                v.id === selectedId ? "bg-white shadow-sm ring-1 ring-schole-primary/30" : "hover:bg-white/80"
              }`}
            >
              <span className="font-medium text-slate-800">{p?.name ?? v.personaId}</span>
              <span className="text-slate-500">
                {v.converted ? "Converted" : v.bounced ? "Bounced" : "Lost"}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-3 text-sm text-slate-500">No visits match filters.</p>
        )}
      </div>
    </div>
  );
}

function OutcomeBadge({ converted, bounced }: { converted: boolean; bounced: boolean }) {
  const label = converted ? "Converted" : bounced ? "Bounced" : "Lost";
  const cls = converted
    ? "bg-emerald-100 text-emerald-800"
    : bounced
      ? "bg-amber-100 text-amber-800"
      : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}
