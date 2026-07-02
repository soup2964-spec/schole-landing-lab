"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VisitIndex, VisitSummary } from "@/lib/registry";
import type { Visit } from "@/lib/schema/events";
import type { PageVariant } from "@/lib/schema/page";
import { PERSONA_SET_V1 } from "@/config/personas";
import { ReplayTheater } from "@/components/ReplayTheater";
import {
  ScrollDepthBar,
  VariantSectionHeatmap,
  VisitPathStrip,
} from "@/components/behavior/VisitVisuals";

type OutcomeFilter = "all" | "converted" | "lost" | "bounced";

export function BehaviorDashboard({
  index,
  variants,
}: {
  index: VisitIndex;
  variants: PageVariant[];
}) {
  const [genIdx, setGenIdx] = useState(index.length - 1);
  const [variantId, setVariantId] = useState(index[index.length - 1]?.variantIds[0] ?? "");
  const [personaFilter, setPersonaFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(false);

  const gen = index[genIdx];
  const variant = variants.find((v) => v.id === variantId);
  const metrics = gen?.metrics.find((m) => m.variantId === variantId);

  const filtered = useMemo(() => {
    let list = gen?.visits.filter((v) => v.variantId === variantId) ?? [];
    if (personaFilter !== "all") list = list.filter((v) => v.personaId === personaFilter);
    if (outcomeFilter === "converted") list = list.filter((v) => v.converted);
    if (outcomeFilter === "lost") list = list.filter((v) => !v.converted);
    if (outcomeFilter === "bounced") list = list.filter((v) => v.bounced);
    return list;
  }, [gen, variantId, personaFilter, outcomeFilter]);

  const stats = useMemo(() => {
    const visits = gen?.visits.filter((v) => v.variantId === variantId) ?? [];
    const n = visits.length || 1;
    return {
      visits: visits.length,
      conversionRate: visits.filter((v) => v.converted).length / n,
      bounceRate: visits.filter((v) => v.bounced).length / n,
      avgScroll: visits.reduce((s, v) => s + v.scrollDepth, 0) / n,
      avgDwell: visits.reduce((s, v) => s + v.totalDwellMs, 0) / n,
    };
  }, [gen, variantId]);

  const fetchVisit = useCallback(async (id: string, generation: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/visits/${encodeURIComponent(id)}?gen=${generation}`);
      if (!res.ok) throw new Error("Failed");
      setVisit((await res.json()) as Visit);
    } catch {
      setVisit(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      setVisit(null);
      return;
    }
    const pick = filtered.find((v) => v.id === selectedId) ?? filtered[0];
    if (pick.id !== selectedId) setSelectedId(pick.id);
    fetchVisit(pick.id, gen.generation);
  }, [filtered, selectedId, gen.generation, fetchVisit]);

  const selectedSummary = filtered.find((v) => v.id === selectedId);

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Visits" value={String(stats.visits)} />
        <Kpi label="Conversion" value={`${(stats.conversionRate * 100).toFixed(1)}%`} accent />
        <Kpi label="Bounce rate" value={`${(stats.bounceRate * 100).toFixed(0)}%`} />
        <Kpi label="Avg scroll" value={`${(stats.avgScroll * 100).toFixed(0)}%`} />
        <Kpi label="Avg dwell" value={`${(stats.avgDwell / 1000).toFixed(0)}s`} />
      </div>

      {/* Filters */}
      <div className="sticky top-[57px] z-30 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/95 p-3 backdrop-blur">
        <FilterSelect
          label="Generation"
          value={String(genIdx)}
          onChange={(v) => {
            const idx = Number(v);
            setGenIdx(idx);
            setVariantId(index[idx].variantIds[0]);
            setSelectedId(null);
          }}
          options={index.map((g, i) => ({
            value: String(i),
            label: `Gen ${g.generation} · ${g.visits.length} visits`,
          }))}
        />
        <FilterSelect
          label="Variant"
          value={variantId}
          onChange={(v) => {
            setVariantId(v);
            setSelectedId(null);
          }}
          options={(gen?.variantIds ?? []).map((id) => {
            const v = variants.find((x) => x.id === id);
            return { value: id, label: v?.name ?? id };
          })}
        />
        <FilterSelect
          label="Persona"
          value={personaFilter}
          onChange={setPersonaFilter}
          options={[
            { value: "all", label: "All personas" },
            ...PERSONA_SET_V1.personas.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <div className="flex gap-1">
          {(["all", "converted", "lost", "bounced"] as OutcomeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setOutcomeFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
                outcomeFilter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500">{filtered.length} matching</span>
      </div>

      {/* Main split */}
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Visit preview list */}
        <aside className="max-h-[720px] space-y-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Visit previews
          </div>
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No visits match filters.</p>
          ) : (
            filtered.slice(0, 100).map((v) => (
              <VisitPreviewCard
                key={v.id}
                summary={v}
                variant={variant}
                selected={v.id === selectedId}
                onSelect={() => setSelectedId(v.id)}
              />
            ))
          )}
          {filtered.length > 100 && (
            <p className="px-2 py-2 text-xs text-slate-600">
              Showing first 100 of {filtered.length}. Narrow filters to see more.
            </p>
          )}
        </aside>

        {/* Detail pane */}
        <div className="space-y-6">
          {selectedSummary && variant && (
            <SelectedVisitHeader summary={selectedSummary} variant={variant} />
          )}

          {loading && (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40">
              <p className="text-sm text-slate-500">Loading full visit trace…</p>
            </div>
          )}

          {!loading && visit && variant && (
            <ReplayTheater visit={visit} variant={variant} />
          )}

          {variant && metrics && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Section engagement · {variant.name}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Aggregate read rate and exit rate across all {stats.visits} simulated visits on this
                variant.
              </p>
              <div className="mt-4">
                <VariantSectionHeatmap variant={variant} perSection={metrics.perSection} />
              </div>
            </section>
          )}

          {metrics && (
            <PersonaBreakdown metrics={metrics} />
          )}
        </div>
      </div>
    </div>
  );
}

function VisitPreviewCard({
  summary,
  variant,
  selected,
  onSelect,
}: {
  summary: VisitSummary;
  variant?: PageVariant;
  selected: boolean;
  onSelect: () => void;
}) {
  const persona = PERSONA_SET_V1.personas.find((p) => p.id === summary.personaId);

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition ${
        selected
          ? "border-indigo-500/60 bg-indigo-500/10"
          : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-bold ${
            summary.converted
              ? "bg-emerald-500/20 text-emerald-400"
              : summary.bounced
                ? "bg-rose-500/20 text-rose-400"
                : "bg-slate-800 text-slate-400"
          }`}
        >
          {persona?.name?.[0] ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-white">
              {persona?.name ?? summary.personaId}
            </span>
            <OutcomeBadge summary={summary} />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{persona?.role}</p>
          <div className="mt-2">
            <ScrollDepthBar depth={summary.scrollDepth} />
          </div>
          {variant && (
            <div className="mt-2">
              <VisitPathStrip path={summary.path} sections={variant.sections} compact />
            </div>
          )}
          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
            {summary.verdictPreview}
          </p>
          <div className="mt-1 text-[10px] text-slate-600">
            {(summary.totalDwellMs / 1000).toFixed(0)}s on page
          </div>
        </div>
      </div>
    </button>
  );
}

function SelectedVisitHeader({
  summary,
  variant,
}: {
  summary: VisitSummary;
  variant: PageVariant;
}) {
  const persona = PERSONA_SET_V1.personas.find((p) => p.id === summary.personaId);
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Selected visit</div>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {persona?.name} on {variant.name}
          </h2>
          <p className="text-sm text-slate-400">{persona?.role}</p>
        </div>
        <OutcomeBadge summary={summary} large />
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <span>
          Scroll <strong className="text-slate-300">{(summary.scrollDepth * 100).toFixed(0)}%</strong>
        </span>
        <span>
          Dwell <strong className="text-slate-300">{(summary.totalDwellMs / 1000).toFixed(0)}s</strong>
        </span>
        <span>
          Sections touched <strong className="text-slate-300">{summary.path.length}</strong>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-600">
        <LegendDot color="bg-indigo-500" label="Read" />
        <LegendDot color="bg-amber-400" label="Skim" />
        <LegendDot color="bg-rose-500" label="Bounce" />
      </div>
    </div>
  );
}

function PersonaBreakdown({
  metrics,
}: {
  metrics: {
    byPersona: Record<string, { visits: number; conversions: number }>;
  };
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Conversion by persona
      </h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {PERSONA_SET_V1.personas.map((p) => {
          const row = metrics.byPersona[p.id] ?? { visits: 0, conversions: 0 };
          const rate = row.visits ? row.conversions / row.visits : 0;
          return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2"
            >
              <div>
                <div className="text-sm font-medium text-white">{p.name}</div>
                <div className="text-[10px] text-slate-500">{row.visits} visits</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-indigo-300">
                  {(rate * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-slate-600">{row.conversions} conv</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OutcomeBadge({ summary, large }: { summary: VisitSummary; large?: boolean }) {
  const label = summary.converted ? "Converted" : summary.bounced ? "Bounced" : "Lost";
  const cls = summary.converted
    ? "bg-emerald-500/15 text-emerald-400"
    : summary.bounced
      ? "bg-rose-500/15 text-rose-400"
      : "bg-slate-700/50 text-slate-400";
  return (
    <span
      className={`rounded-full font-medium ${cls} ${large ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"}`}
    >
      {label}
    </span>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-indigo-500/40 bg-indigo-500/10" : "border-slate-800 bg-slate-900/60"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      <span className="hidden sm:inline">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-3 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
