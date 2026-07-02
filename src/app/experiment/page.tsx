import { PageShell } from "@/components/Nav";
import { PERSONA_SET_V1 } from "@/config/personas";

export default function ExperimentPage() {
  return (
    <PageShell
      active="/experiment"
      title="How the pages are compared"
      subtitle="The experimental method: who the simulated visitors are, how they decide, how traffic is allocated, and how winners are determined."
    >
      <section className="mb-10 grid gap-4 md:grid-cols-3">
        <MethodCard
          title="Objection-gated conversion"
          body="Each persona carries critical objections sourced from buyer research. A section only resolves an objection if its content substantively answers it - and a persona only converts once its critical objections are resolved. Behavior becomes causal: we know which missing answer killed each conversion."
        />
        <MethodCard
          title="Thompson sampling allocation"
          body="Instead of a fixed 1/6 traffic split, each simulated visit is routed by sampling from Beta posteriors over conversion. Winners earn traffic as evidence accumulates; losers keep a small exploration share. The allocation chart on the Results page shows this happening."
        />
        <MethodCard
          title="Judge / actor separation"
          body="Visitor agents browse. A separate evaluator agent scores pages on a fixed rubric and writes the report. A third optimizer agent breeds new pages. No agent grades its own homework."
        />
      </section>

      <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="font-semibold text-white">The behavioral model, honestly stated</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
          <li>
            <b className="text-slate-300">LLM readings × Monte Carlo visits.</b> Each persona
            LLM-reads each page a few times, producing per-section appeal, sentiment, objection
            effects, and verbalized thoughts. Hundreds of stochastic visits are then sampled from
            those readings - patience budgets, fatigue, skim probability, and skepticism noise make
            every visit different while LLM cost stays bounded.
          </li>
          <li>
            <b className="text-slate-300">Position bias falls out naturally.</b> Agents read top to
            bottom with a finite attention budget, so later sections are seen less - consistent
            with Nielsen Norman Group scroll research (~57% of viewing time above the fold).
          </li>
          <li>
            <b className="text-slate-300">Calibration anchors.</b> Persona parameters are tuned so
            aggregate conversion lands in the 2-5% B2B SaaS benchmark range and bounce behavior
            matches published norms - and they live in a versioned config designed to be
            recalibrated from real PostHog / GTM traffic via the calibration API.
          </li>
          <li>
            <b className="text-slate-300">Fitness score.</b> 60% conversion rate + 20% scroll depth
            + 10% inverse bounce + 10% sentiment. Conversion dominates on purpose: engagement that
            doesn&apos;t convert is decoration.
          </li>
        </ul>
      </section>

      <h2 className="mb-4 text-lg font-semibold text-white">
        The simulated visitors ({PERSONA_SET_V1.personas.length} personas, v{PERSONA_SET_V1.version})
      </h2>
      <p className="mb-6 max-w-3xl text-sm text-slate-400">
        Every attribute is grounded in published 2025-26 buyer research - sources cited on each
        card. Traffic weights, patience, skepticism, and objections are the calibratable surface
        the system can update from real behavioral data.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {PERSONA_SET_V1.personas.map((p) => (
          <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white">
                  {p.name} <span className="font-normal text-slate-500">· {p.role}</span>
                </h3>
              </div>
              <span className="flex-none rounded-full bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-400">
                {(p.trafficWeight * 100).toFixed(0)}% traffic
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.profile}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>
                patience <b className="text-slate-300">{p.patienceSeconds.mean}s</b>
              </span>
              <span>
                skepticism <b className="text-slate-300">{p.skepticism}</b>
              </span>
              <span>
                skim <b className="text-slate-300">{p.skimPropensity}</b>
              </span>
              <span>
                CTA propensity <b className="text-slate-300">{p.ctaPropensity}</b>
              </span>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Objection ledger
              </div>
              <ul className="mt-2 space-y-2">
                {p.objections.map((o) => (
                  <li key={o.id} className="rounded-lg bg-slate-950/60 p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <code className="text-indigo-400">{o.id}</code>
                      {o.critical && (
                        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                          CRITICAL
                        </span>
                      )}
                    </div>
                    <p className="mt-1 italic text-slate-300">&quot;{o.text}&quot;</p>
                    <p className="mt-1 text-slate-600">{o.groundedIn}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function MethodCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}
