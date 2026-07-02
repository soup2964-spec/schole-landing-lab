import type { ExperimentRun } from "@/lib/schema/experiment";
import type { PageVariant } from "@/lib/schema/page";
import type { VariantDecision } from "@/lib/stats/bayes";

export function WinnersDetail({
  run,
  variants,
}: {
  run: ExperimentRun | null;
  variants: PageVariant[];
}) {
  if (!run?.generations.length) {
    return <p className="text-sm text-slate-500">No results yet.</p>;
  }

  const lastGen = run.generations[run.generations.length - 1];
  const top3 = lastGen.metrics.slice(0, 3);
  const maxConv = top3[0]?.conversionRate ?? 1;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {top3.map((m, i) => {
          const v = variants.find((x) => x.id === m.variantId);
          const d = lastGen.decisions?.find((x) => x.variantId === m.variantId);
          const rankLabels = ["1st", "2nd", "3rd"];
          return (
            <div
              key={m.variantId}
              className={`rounded-xl border p-4 ${
                i === 0 ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {rankLabels[i]}
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900">{v?.name ?? m.variantId}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {(m.conversionRate * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500">
                Fitness {m.fitness.toFixed(1)}
                {d ? ` · P(best) ${(d.pBest * 100).toFixed(0)}%` : ""}
              </p>
              {d && <DecisionChip decision={d} />}
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Conversion by variant
        </h3>
        <div className="mt-2 space-y-2">
          {lastGen.metrics.map((m) => {
            const v = variants.find((x) => x.id === m.variantId);
            return (
              <div key={m.variantId}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{v?.name ?? m.variantId}</span>
                  <span>{(m.conversionRate * 100).toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-schole-primary"
                    style={{ width: `${(m.conversionRate / maxConv) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <details className="rounded-xl border border-slate-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
          Full leaderboard
        </summary>
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Rank</th>
                <th className="px-4 py-2">Variant</th>
                <th className="px-4 py-2">Conv</th>
                <th className="px-4 py-2">Fitness</th>
                <th className="px-4 py-2">Decision</th>
              </tr>
            </thead>
            <tbody>
              {lastGen.metrics.map((m, i) => {
                const v = variants.find((x) => x.id === m.variantId);
                const d = lastGen.decisions?.find((x) => x.variantId === m.variantId);
                return (
                  <tr key={m.variantId} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{v?.name ?? m.variantId}</td>
                    <td className="px-4 py-2">{(m.conversionRate * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2">{m.fitness.toFixed(1)}</td>
                    <td className="px-4 py-2">{d ? <DecisionChip decision={d} /> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      {lastGen.report.insights && (
        <div className="rounded-xl border border-schole-primary/20 bg-schole-primary/5 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-schole-primary">
            Winner insight
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {lastGen.report.insights.slice(0, 400)}
            {lastGen.report.insights.length > 400 ? "…" : ""}
          </p>
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
    <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[decision.status]}`}>
      {labels[decision.status]}
    </span>
  );
}
