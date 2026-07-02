import Link from "next/link";
import { CRITERIA } from "@/config/criteria";
import { PERSONA_SET_V1 } from "@/config/personas";
import { ChallengeSection, schole, StatCard } from "@/components/schole-ui";
import { ChallengeBehaviorPreview } from "@/components/challenge/ChallengeBehaviorPreview";
import { ChallengeResultsBlock } from "@/components/challenge/ChallengeResultsBlock";
import { allVariants, loadRun, visitIndex } from "@/lib/registry";
import { staticReplicaPath } from "@/lib/replica/paths";

export function ChallengeDashboard() {
  const run = loadRun();
  const variants = allVariants();
  const gen0 = variants.filter((v) => v.generation === 0);
  const bred = variants.filter((v) => v.generation > 0);
  const lastGen = run?.generations[run.generations.length - 1];
  const totalVisits = run?.generations.reduce((s, g) => s + g.visits.length, 0) ?? 0;
  const latestMetrics = new Map(
    run?.generations.flatMap((g) => g.metrics.map((m) => [m.variantId, m] as const)) ?? []
  );

  return (
    <>
      {/* Overview grid — jump to each criterion */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CRITERIA.map((c) => (
          <a
            key={c.id}
            href={`#section-${c.id}`}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-schole-primary hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-schole-primary text-sm font-bold text-white">
                {c.id}
              </span>
              <span className="text-sm font-semibold text-slate-900 group-hover:text-schole-primary">
                {c.title}
              </span>
            </div>
          </a>
        ))}
      </div>

      {run && lastGen && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Simulated visits" value={totalVisits.toLocaleString()} />
          <StatCard
            label="Best gen-0 conversion"
            value={`${((run.generations[0]?.metrics[0]?.conversionRate ?? 0) * 100).toFixed(1)}%`}
            sub={run.generations[0]?.metrics[0]?.variantId}
          />
          <StatCard
            label={`Best gen-${lastGen.generation} conversion`}
            value={`${((lastGen.metrics[0]?.conversionRate ?? 0) * 100).toFixed(1)}%`}
            sub={lastGen.metrics[0]?.variantId}
            highlight
          />
        </div>
      )}

      <ChallengeSection
        n="1"
        title={CRITERIA[0].title}
        subtitle="Six Generation-0 pages on the exact schole.ai Framer layout — same structure, different strategic copy per ICP."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gen0.map((v) => {
            const src = staticReplicaPath(v.id);
            const m = latestMetrics.get(v.id);
            return (
              <div key={v.id} className={`${schole.cardMuted} overflow-hidden p-0`}>
                {src && (
                  <div className="relative h-40 overflow-hidden border-b border-slate-200 bg-white">
                    <iframe
                      src={src}
                      title={v.name}
                      className="pointer-events-none h-[800px] w-[400%] origin-top-left scale-[0.25] border-0"
                      tabIndex={-1}
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900">{v.name}</h3>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                    {v.id} · {v.strategy}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{v.thesis}</p>
                  {m && (
                    <p className="mt-2 text-xs font-medium text-schole-primary">
                      {(m.conversionRate * 100).toFixed(1)}% conv · fitness {m.fitness.toFixed(1)}
                    </p>
                  )}
                  <Link href={`/v/${v.id}`} target="_blank" className={`${schole.btnPrimary} mt-3`}>
                    Open page ↗
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </ChallengeSection>

      <ChallengeSection
        n="2"
        title={CRITERIA[1].title}
        subtitle="Objection-gated LLM personas · Thompson sampling · Bayesian promote/kill · separate evaluator and optimizer agents."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MethodCard title="Personas + objections" body="6 buyers from 2025–26 research, each with a ledger of critical objections that must be resolved to convert." />
          <MethodCard title="Traffic allocation" body="Thompson sampling routes each simulated visit using Beta posteriors — winners earn traffic over time." />
          <MethodCard title="Winner selection" body="Promote at P(best) ≥ 95%. Kill at P(beat baseline) < 5%. Fitness = 60% conv + 20% scroll + 10% bounce + 10% sentiment." />
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONA_SET_V1.personas.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex justify-between text-sm font-medium text-slate-900">
                <span>{p.name}</span>
                <span className="text-xs text-slate-500">{(p.trafficWeight * 100).toFixed(0)}%</span>
              </div>
              <p className="text-[11px] text-slate-500">{p.role}</p>
            </div>
          ))}
        </div>
      </ChallengeSection>

      <ChallengeSection
        n="3"
        title={CRITERIA[2].title}
        subtitle="Pick a visit below to replay scroll path, section engagement, and the agent's reasoning."
      >
        {run ? (
          <ChallengeBehaviorPreview initialIndex={visitIndex(run)} initialVariants={variants} />
        ) : (
          <p className="text-sm text-slate-500">Run npm run demo to populate behavior data.</p>
        )}
      </ChallengeSection>

      <ChallengeSection
        n="4"
        title={CRITERIA[3].title}
        subtitle="Bayesian leaderboard per generation with credible intervals, P(best), and promote/kill decisions."
      >
        {run ? (
          <ChallengeResultsBlock run={run} variants={variants} />
        ) : (
          <p className="text-sm text-slate-500">No results yet.</p>
        )}
      </ChallengeSection>

      <ChallengeSection
        n="5"
        title={CRITERIA[4].title}
        subtitle="Pages bred by the optimizer from behavioral evidence on winners and strong parent sections."
      >
        {bred.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {bred.map((v) => (
              <article key={v.id} id={v.id} className={`${schole.cardHighlight} scroll-mt-28`}>
                <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Gen {v.generation} · bred variant
                </div>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{v.name}</h3>
                <p className="font-mono text-xs text-slate-500">{v.id}</p>
                <p className="mt-2 text-sm text-slate-600">{v.thesis}</p>
                {v.parentIds.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">Parents: {v.parentIds.join(" + ")}</p>
                )}
                <Link href={`/v/${v.id}`} target="_blank" className={`${schole.btnPrimary} mt-3`}>
                  Open page ↗
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No bred variants in this run.</p>
        )}
      </ChallengeSection>

      <ChallengeSection
        n="6"
        title={CRITERIA[5].title}
        subtitle="Full changelogs with the simulated behavior and evaluator evidence behind each copy change."
      >
        {bred.some((v) => v.changelog?.length) ? (
          <div className="space-y-6">
            {bred.map((v) =>
              v.changelog?.length ? (
                <div key={v.id} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="font-semibold text-slate-900">
                    {v.name}{" "}
                    <code className="ml-1 text-xs font-normal text-slate-500">{v.id}</code>
                  </h3>
                  <ol className="mt-3 space-y-3">
                    {v.changelog.map((c, i) => (
                      <li key={i} className="rounded-lg border border-slate-200 bg-white p-4">
                        <p className="font-medium text-slate-900">{c.what}</p>
                        <p className="mt-1 text-sm text-slate-600">{c.why}</p>
                        <p className="mt-2 text-xs text-schole-primary">
                          Evidence: {c.evidence}
                          {c.sourceVariantId && (
                            <span className="text-slate-500"> · from {c.sourceVariantId}</span>
                          )}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Changelogs appear when the optimizer breeds variants.</p>
        )}
      </ChallengeSection>
    </>
  );
}

function MethodCard({ title, body }: { title: string; body: string }) {
  return (
    <div className={schole.cardMuted}>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}
