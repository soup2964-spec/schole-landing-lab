import type { ExperimentRun } from "@/lib/schema/experiment";
import type { PageVariant } from "@/lib/schema/page";
import type { VariantDecision } from "@/lib/stats/bayes";
import { schole } from "@/components/schole-ui";

export function ChallengeResultsBlock({
  run,
  variants,
}: {
  run: ExperimentRun;
  variants: PageVariant[];
}) {
  const lastGen = run.generations[run.generations.length - 1];

  return (
    <div className="space-y-8">
      {run.generations.map((gen) => (
        <div key={gen.generation}>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Generation {gen.generation}
            <span className="ml-2 font-normal text-slate-500">
              {gen.totalVisits?.toLocaleString() ?? gen.visits.length} visits
            </span>
          </h3>
          <div className={`${schole.card} overflow-x-auto p-0`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-schole-surface text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">Fitness</th>
                  <th className="px-4 py-3">Conversion [95% CI]</th>
                  <th className="px-4 py-3">P(best)</th>
                  <th className="px-4 py-3">Decision</th>
                </tr>
              </thead>
              <tbody>
                {gen.metrics.map((m, i) => {
                  const v = variants.find((x) => x.id === m.variantId);
                  const d = gen.decisions?.find((x) => x.variantId === m.variantId);
                  return (
                    <tr key={m.variantId} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{v?.name ?? m.variantId}</div>
                        <div className="font-mono text-xs text-slate-500">{m.visits} visits</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${i === 0 ? "text-emerald-600" : "text-slate-700"}`}>
                          {m.fitness.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {(m.conversionRate * 100).toFixed(1)}%
                        {d && (
                          <span className="ml-1 text-xs text-slate-500">
                            [{(d.ci95[0] * 100).toFixed(1)}–{(d.ci95[1] * 100).toFixed(1)}%]
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {d ? `${(d.pBest * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {d ? <DecisionChip decision={d} /> : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {lastGen && (
        <div className={`${schole.card} grid gap-4 lg:grid-cols-2`}>
          <div>
            <h4 className="font-semibold text-slate-900">Bandit allocation (latest gen)</h4>
            <AllocationBars history={lastGen.allocationHistory} variantIds={lastGen.variantIds} />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">Winner insight</h4>
            <p className="mt-2 text-sm text-slate-600">{lastGen.report.insights.slice(0, 400)}…</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DecisionChip({ decision }: { decision: VariantDecision }) {
  const styles: Record<VariantDecision["status"], string> = {
    promoted: "bg-emerald-100 text-emerald-800",
    killed: "bg-rose-100 text-rose-800",
    collecting: "bg-slate-100 text-slate-600",
  };
  const labels: Record<VariantDecision["status"], string> = {
    promoted: "Promoted",
    killed: "Killed",
    collecting: "Collecting",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[decision.status]}`}>
      {labels[decision.status]}
    </span>
  );
}

function AllocationBars({
  history,
  variantIds,
}: {
  history: { afterVisits: number; shares: Record<string, number> }[];
  variantIds: string[];
}) {
  if (!history.length) return <p className="mt-2 text-sm text-slate-500">No allocation data.</p>;
  const last = history[history.length - 1];
  const colors = ["bg-schole-primary", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-violet-500"];

  return (
    <div className="mt-3 space-y-2">
      {variantIds.map((id, i) => (
        <div key={id}>
          <div className="flex justify-between text-xs">
            <span className="font-mono text-slate-500">{id}</span>
            <span>{((last.shares[id] ?? 0) * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full ${colors[i % colors.length]}`}
              style={{ width: `${(last.shares[id] ?? 0) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
