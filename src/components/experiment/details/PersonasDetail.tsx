"use client";

import { useCallback, useEffect, useState } from "react";
import { PERSONA_SET_V1 } from "@/config/personas";
import type { Persona } from "@/lib/schema/persona";
import { PersonaResearchLinks } from "./PersonaResearchLinks";
/**
 * User personas — who simulates visits and what must be true for them to convert.
 */
export function PersonasDetail() {
  const [openId, setOpenId] = useState<string>(PERSONA_SET_V1.personas[0]?.id ?? "");
  const close = useCallback(() => setOpenId(""), []);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close]);

  const openPersona = PERSONA_SET_V1.personas.find((p) => p.id === openId);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-600">
        Six evidence-grounded buyer personas simulate visits on each variant. Each carries goals,
        skepticism, and an objection ledger — a session only counts as{" "}
        <code className="rounded bg-slate-100 px-1">book_demo_click</code> when every critical
        objection is resolved before the CTA.
      </p>

      <p className="text-xs text-slate-500">
        Persona set v{PERSONA_SET_V1.version} · priors from McKinsey, OECD, WEF, Gallup, LinkedIn,
        Fosway & EUR-Lex · calibratable from live PostHog traffic.
      </p>

      <div className="relative">
        <div
          className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="User personas"
        >
          {PERSONA_SET_V1.personas.map((persona) => {
            const active = openId === persona.id;
            return (
              <button
                key={persona.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`persona-panel-${persona.id}`}
                onClick={() => setOpenId(active ? "" : persona.id)}
                className={`flex min-w-[9.5rem] flex-1 shrink-0 flex-col rounded-xl border px-3 py-3 text-left transition ${
                  active
                    ? "border-schole-primary/40 bg-schole-primary/5 ring-2 ring-schole-primary/30 shadow-md"
                    : "border-slate-200 bg-white hover:shadow-sm"
                }`}
              >
                <span className="text-sm font-semibold leading-tight text-slate-900">
                  {persona.name}
                </span>
                <span className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">{persona.role}</span>
                <span className="mt-2 truncate font-mono text-[10px] font-medium text-slate-500">
                  {(persona.trafficWeight * 100).toFixed(0)}% traffic mix
                </span>
              </button>
            );
          })}
        </div>

        {openId && openPersona && (
          <div
            id={`persona-panel-${openId}`}
            role="tabpanel"
            className="relative mt-3 rounded-xl border border-schole-primary/20 bg-schole-primary/5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3 border-b border-black/5 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Persona
                </p>
                <h3 className="text-base font-semibold text-slate-900">
                  {openPersona.name}
                  <span className="ml-2 text-sm font-normal text-slate-500">{openPersona.role}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={close}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                aria-label="Close persona details"
              >
                Close
              </button>
            </div>

            <div className="max-h-[min(32rem,60vh)] overflow-y-auto p-4">
              <PersonaPanel persona={openPersona} />
            </div>
          </div>
        )}
      </div>

      <PersonaResearchLinks className="mt-6" />
    </div>
  );
}

function PersonaPanel({ persona }: { persona: Persona }) {
  const critical = persona.objections.filter((o) => o.critical);
  const soft = persona.objections.filter((o) => !o.critical);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-700">{persona.profile}</p>

      <div className="flex flex-wrap gap-2">
        <BehaviorChip label="Traffic share" value={`${(persona.trafficWeight * 100).toFixed(0)}%`} />
        <BehaviorChip label="Skepticism" value={persona.skepticism.toFixed(2)} />
        <BehaviorChip label="Skim propensity" value={persona.skimPropensity.toFixed(2)} />
        <BehaviorChip label="CTA propensity" value={persona.ctaPropensity.toFixed(2)} />
        <BehaviorChip
          label="Patience"
          value={`~${persona.patienceSeconds.mean}s`}
        />
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Goals</h4>
        <ul className="mt-2 flex flex-wrap gap-2">
          {persona.goals.map((goal) => (
            <li
              key={goal}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
            >
              {goal}
            </li>
          ))}
        </ul>
      </div>

      {critical.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Critical objections — must resolve to convert
          </h4>
          <div className="mt-2 space-y-2">
            {critical.map((o) => (
              <ObjectionCard key={o.id} objection={o} critical />
            ))}
          </div>
        </div>
      )}

      {soft.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Soft objections
          </h4>
          <div className="mt-2 space-y-2">
            {soft.map((o) => (
              <ObjectionCard key={o.id} objection={o} />
            ))}
          </div>
        </div>
      )}

      {persona.groundedIn.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Research basis</p>
          <ul className="mt-1 space-y-1">
            {persona.groundedIn.map((cite) => (
              <li key={cite} className="text-xs text-slate-600">
                {cite}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ObjectionCard({
  objection,
  critical,
}: {
  objection: Persona["objections"][number];
  critical?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        critical ? "border-rose-200 bg-white" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-sm text-slate-800">&ldquo;{objection.text}&rdquo;</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{objection.groundedIn}</p>
    </div>
  );
}

function BehaviorChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-slate-900">{value}</div>
    </div>
  );
}
