import { PageShell, EmptyRun } from "@/components/Nav";
import { loadRun, allVariants } from "@/lib/registry";
import type { VariantDecision } from "@/lib/stats/bayes";
import fs from "fs";
import path from "path";

interface AaTestSummary {
  ranAt: string;
  replications: number;
  visitsPerReplication: number;
  arms: number;
  falsePromotionRate: number;
  falseKillRate: number;
  avgMaxPBest: number;
  allocationShareRange: [number, number];
  verdict: string;
}

function loadAaTest(): AaTestSummary | null {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "aa-test.json"), "utf8")
    ) as AaTestSummary;
  } catch {
    return null;
  }
}

export default function ResultsPage() {
  const run = loadRun();
  const variants = allVariants();
  const aaTest = loadAaTest();

  if (!run) {
    return (
      <PageShell
        active="/results"
        title="Which versions performed better"
        subtitle="Leaderboard, bandit allocation over time, and evaluator scorecards per generation."
      >
        <EmptyRun />
      </PageShell>
    );
  }

  return (
    <PageShell
      active="/results"
      title="Which versions performed better"
      subtitle="Bayesian leaderboard with credible intervals and promote/kill decisions, bandit allocation over time, and evaluator scorecards per generation."
    >
      <StatsMethodCard aaTest={aaTest} />
      {run.generations.map((gen) => (
        <section key={gen.generation} className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Generation {gen.generation}
            {gen.totalVisits && (
              <span className="ml-3 text-xs font-normal text-slate-500">
                {gen.totalVisits.toLocaleString()} simulated visits
              </span>
            )}
          </h2>

          <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">Fitness</th>
                  <th className="px-4 py-3">Conversion [95% CI]</th>
                  <th className="px-4 py-3">P(best)</th>
                  <th className="px-4 py-3">Exp. loss</th>
                  <th className="px-4 py-3">Decision</th>
                </tr>
              </thead>
              <tbody>
                {gen.metrics.map((m, i) => {
                  const v = variants.find((x) => x.id === m.variantId);
                  const d = gen.decisions?.find((x) => x.variantId === m.variantId);
                  return (
                    <tr key={m.variantId} className="border-t border-slate-800">
                      <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{v?.name ?? m.variantId}</div>
                        <div className="font-mono text-xs text-slate-500">
                          {m.variantId} · {m.visits} visits
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-bold ${i === 0 ? "text-emerald-400" : "text-slate-300"}`}
                        >
                          {m.fitness.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {(m.conversionRate * 100).toFixed(1)}%
                        {d && (
                          <span className="ml-1 text-xs text-slate-500">
                            [{(d.ci95[0] * 100).toFixed(1)}–{(d.ci95[1] * 100).toFixed(1)}%]
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {d ? (
                          <PBestBar value={d.pBest} />
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {d ? `${d.expectedLossPp.toFixed(2)}pp` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {d ? <DecisionChip decision={d} /> : <span className="text-xs text-slate-600">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {gen.decisions && <DecisionNotes decisions={gen.decisions} />}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="font-semibold text-white">Bandit traffic allocation</h3>
              <p className="mt-1 text-xs text-slate-500">
                Thompson sampling share over visits (winners earn traffic as evidence accumulates).
              </p>
              <AllocationChart history={gen.allocationHistory} variantIds={gen.variantIds} />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="font-semibold text-white">Top conversion blockers</h3>
              <p className="mt-1 text-xs text-slate-500">
                Unresolved critical objections at exit, aggregated across variants.
              </p>
              <ul className="mt-4 space-y-2">
                {topObjectionFailures(gen.metrics).map(([o, c]) => (
                  <li key={o} className="flex justify-between text-sm">
                    <code className="text-rose-400">{o}</code>
                    <span className="text-slate-400">{c} lost visits</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 font-semibold text-white">Evaluator scorecards</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {gen.report.scorecards.map((sc) => (
                <div
                  key={sc.variantId}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <div className="font-mono text-xs text-slate-500">{sc.variantId}</div>
                  <p className="mt-2 text-sm text-slate-300">{sc.summary}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Score label="Value clarity" value={sc.valueClarity} />
                    <Score label="Credibility" value={sc.credibility} />
                    <Score label="CTA strength" value={sc.ctaStrength} />
                    <Score label="Audience fit" value={sc.audienceFit} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="font-semibold text-white">Generation insights</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {gen.report.insights}
            </p>
            <ul className="mt-4 space-y-2">
              {gen.report.findings.map((f, i) => (
                <li key={i} className="text-sm text-slate-400">
                  <span className="text-slate-200">{f.finding}</span>
                  <span className="block text-xs text-slate-600">Evidence: {f.evidence}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <FitnessCurve run={run} variants={variants} />
    </PageShell>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="font-semibold text-white">{value.toFixed(1)}/10</div>
    </div>
  );
}

function PBestBar({ value }: { value: number }) {
  const pct = value * 100;
  const color =
    pct >= 95 ? "bg-emerald-500" : pct >= 70 ? "bg-indigo-500" : "bg-slate-600";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-400">{pct.toFixed(0)}%</span>
    </div>
  );
}

function DecisionChip({ decision }: { decision: VariantDecision }) {
  const styles: Record<VariantDecision["status"], string> = {
    promoted: "bg-emerald-500/15 text-emerald-400",
    killed: "bg-rose-500/15 text-rose-400",
    collecting: "bg-slate-700/50 text-slate-400",
  };
  const labels: Record<VariantDecision["status"], string> = {
    promoted: "Promoted",
    killed: "Killed",
    collecting: "Collecting",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[decision.status]}`}
      title={decision.reason}
    >
      {labels[decision.status]}
      {!decision.guardrailBounceOk && " ⚠"}
    </span>
  );
}

function DecisionNotes({ decisions }: { decisions: VariantDecision[] }) {
  const notable = decisions.filter(
    (d) => d.status !== "collecting" || !d.guardrailBounceOk
  );
  if (!notable.length) {
    return (
      <p className="mb-6 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs text-slate-500">
        No variant has cleared the promote gate (P(best) ≥ 95% with expected loss ≤ 0.1pp) or the
        kill gate (P(beat baseline) &lt; 5%) yet — the honest verdict is &quot;keep collecting
        evidence.&quot; The bandit continues shifting traffic toward likely winners in the meantime.
      </p>
    );
  }
  return (
    <div className="mb-6 space-y-2">
      {notable.map((d) => (
        <p
          key={d.variantId}
          className={`rounded-xl border px-4 py-3 text-xs ${
            d.status === "promoted"
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200/90"
              : d.status === "killed"
                ? "border-rose-500/30 bg-rose-500/5 text-rose-200/90"
                : "border-amber-500/30 bg-amber-500/5 text-amber-200/90"
          }`}
        >
          <code className="mr-2">{d.variantId}</code>
          {d.reason}
        </p>
      ))}
    </div>
  );
}

function StatsMethodCard({ aaTest }: { aaTest: AaTestSummary | null }) {
  return (
    <section className="mb-10 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          How winners are decided
        </h2>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-400">
          <li>
            <b className="text-slate-300">Bayesian, not t-tests.</b> Thompson-sampled traffic
            violates fixed-allocation assumptions and the live loop evaluates continuously
            (peeking). Decisions use the joint Beta posterior: always-valid at any sample size.
          </li>
          <li>
            <b className="text-slate-300">Promote</b> when P(best) ≥ 95% <i>and</i> expected loss
            ≤ 0.1pp of conversion. <b className="text-slate-300">Kill</b> when P(beat baseline)
            &lt; 5%. Otherwise: keep collecting.
          </li>
          <li>
            <b className="text-slate-300">Guardrail:</b> a conversion winner is blocked from
            promotion if its bounce rate exceeds baseline by &gt;10% relative.
          </li>
          <li>
            <b className="text-slate-300">Winner&apos;s-curse control:</b> a Beta(3, 97) prior
            (anchored on the 3% B2B benchmark) shrinks small-sample estimates; promoted variants
            are re-validated in the next generation.
          </li>
        </ul>
      </div>

      <div
        className={`rounded-2xl border p-5 ${
          aaTest
            ? aaTest.falsePromotionRate <= 0.1
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-rose-500/30 bg-rose-500/5"
            : "border-slate-800 bg-slate-900/60"
        }`}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          A/A pipeline validation
        </h2>
        {aaTest ? (
          <>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              {aaTest.replications} replications × {aaTest.visitsPerReplication.toLocaleString()}{" "}
              visits with {aaTest.arms} <i>identical</i> copies of the baseline page. A correct
              pipeline should find no winners.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-white">
                  {(aaTest.falsePromotionRate * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-slate-500">false promotions</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">
                  {(aaTest.falseKillRate * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-slate-500">false kills</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">
                  {(aaTest.allocationShareRange[0] * 100).toFixed(0)}–
                  {(aaTest.allocationShareRange[1] * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-slate-500">allocation range (even ≈ 17%)</div>
              </div>
            </div>
            <p
              className={`mt-3 text-xs font-semibold ${
                aaTest.falsePromotionRate <= 0.1 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {aaTest.verdict}
            </p>
          </>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Not run yet. <code className="rounded bg-slate-800 px-1">npm run aa-test</code> runs
            the full pipeline against six identical pages and reports the false-positive rate —
            validating the measurement system before trusting any winner it declares.
          </p>
        )}
      </div>
    </section>
  );
}

function topObjectionFailures(metrics: { objectionFailures: Record<string, number> }[]) {
  const totals = new Map<string, number>();
  for (const m of metrics) {
    for (const [o, c] of Object.entries(m.objectionFailures)) {
      totals.set(o, (totals.get(o) ?? 0) + c);
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function AllocationChart({
  history,
  variantIds,
}: {
  history: { afterVisits: number; shares: Record<string, number> }[];
  variantIds: string[];
}) {
  if (!history.length) return <p className="mt-4 text-sm text-slate-500">No allocation data.</p>;
  const last = history[history.length - 1];
  const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-violet-500"];

  return (
    <div className="mt-4 space-y-3">
      {variantIds.map((id, i) => (
        <div key={id}>
          <div className="flex justify-between text-xs">
            <span className="font-mono text-slate-400">{id}</span>
            <span className="text-slate-500">{((last.shares[id] ?? 0) * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
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

function FitnessCurve({
  run,
  variants,
}: {
  run: NonNullable<ReturnType<typeof loadRun>>;
  variants: ReturnType<typeof allVariants>;
}) {
  const bestPerGen = run.generations.map((g) => g.metrics[0]);
  const gen0Best = run.generations[0]?.metrics[0];
  const lastBest = bestPerGen[bestPerGen.length - 1];

  return (
    <section className="mt-10 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-6">
      <h2 className="font-semibold text-white">Fitness over generations</h2>
      <div className="mt-4 flex items-end gap-4">
        {bestPerGen.map((m, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className="w-12 rounded-t bg-indigo-500"
              style={{ height: `${Math.max(20, m.fitness * 2)}px` }}
            />
            <div className="mt-2 text-xs text-slate-500">Gen {i}</div>
            <div className="text-xs font-bold text-white">{m.fitness.toFixed(0)}</div>
          </div>
        ))}
      </div>
      {gen0Best && lastBest && (
        <p className="mt-4 text-sm text-slate-400">
          Best variant improved from{" "}
          <b className="text-white">{gen0Best.fitness.toFixed(1)}</b> (gen 0,{" "}
          {variants.find((v) => v.id === gen0Best.variantId)?.name}) to{" "}
          <b className="text-white">{lastBest.fitness.toFixed(1)}</b> (gen {run.generations.length - 1},{" "}
          {variants.find((v) => v.id === lastBest.variantId)?.name}).
        </p>
      )}
    </section>
  );
}
