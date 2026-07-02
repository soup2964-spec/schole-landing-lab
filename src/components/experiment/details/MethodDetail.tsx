import { PERSONA_SET_V1 } from "@/config/personas";
import type { ExperimentRun } from "@/lib/schema/experiment";

export function MethodDetail({ run }: { run: ExperimentRun | null }) {
  const totalVisits =
    run?.generations.reduce((s, g) => s + (g.totalVisits ?? g.visits.length), 0) ?? 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        Six objection-gated LLM personas visit landing pages. Thompson sampling allocates traffic.
        Bayesian analysis promotes winners and breeds new variants.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700">
        <span>Personas (6)</span>
        <span className="text-slate-300">→</span>
        <span>Simulated visits</span>
        <span className="text-slate-300">→</span>
        <span>Thompson bandit</span>
        <span className="text-slate-300">→</span>
        <span>Bayesian decisions</span>
        <span className="text-slate-300">→</span>
        <span>Optimizer breeds</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatChip label="Simulated visits" value={totalVisits.toLocaleString()} />
        <StatChip label="Personas" value="6" />
        <StatChip label="Allocation" value="Thompson sampling" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MethodCard
          title="Personas + objections"
          body="Six buyers from 2025–26 research, each with objections that must be resolved to convert."
        />
        <MethodCard
          title="Traffic allocation"
          body="Thompson sampling routes visits using Beta posteriors — winners earn traffic over time."
        />
        <MethodCard
          title="Winner selection"
          body="Promote at P(best) ≥ 95%. Kill at P(beat baseline) < 5%. Fitness blends conversion, scroll, bounce, and sentiment."
        />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Personas</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PERSONA_SET_V1.personas.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex justify-between text-sm font-medium text-slate-900">
                <span>{p.name}</span>
                <span className="text-xs text-slate-500">{(p.trafficWeight * 100).toFixed(0)}%</span>
              </div>
              <p className="text-[11px] text-slate-500">{p.role}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}

function MethodCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}
