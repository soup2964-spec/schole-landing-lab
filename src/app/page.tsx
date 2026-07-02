import Link from "next/link";
import { PageShell } from "@/components/Nav";
import { HomeLiveSection } from "@/components/HomeLiveSection";
import { loadRun } from "@/lib/registry";
import { PERSONA_SET_V1 } from "@/config/personas";

export default function Home() {
  const run = loadRun();
  const totalVisits = run?.generations.reduce((s, g) => s + g.visits.length, 0) ?? 0;
  const gen0Best = run?.generations[0]?.metrics[0];
  const lastGen = run?.generations[run.generations.length - 1];
  const overallBest = lastGen?.metrics[0];

  const steps = [
    {
      n: "01",
      title: "Six strategic bets",
      body: "Six landing pages for Scholé AI, each leading with a different value prop: the current site as baseline, ROI, EU AI Act compliance, problem-first, research credibility, and learner experience.",
      href: "/variants",
    },
    {
      n: "02",
      title: "Evidence-grounded personas",
      body: `${PERSONA_SET_V1.personas.length} buyer personas built from published 2025-26 research (TalentLMS, G2, Rise Up, eLearning Industry), each carrying an objection ledger it must resolve before converting.`,
      href: "/experiment",
    },
    {
      n: "03",
      title: "Autonomous simulation",
      body: "LLM agents walk each page section by section, deciding to read, skim, click, or bounce - emitting the same event stream real analytics would, plus something analytics can't give: why.",
      href: "/behavior",
    },
    {
      n: "04",
      title: "Bandit-allocated evaluation",
      body: "Thompson sampling shifts simulated traffic toward winners as evidence accumulates. An evaluator agent scores every page on a fixed rubric and writes the generation report.",
      href: "/results",
    },
    {
      n: "05",
      title: "Breeding new variants",
      body: "An optimizer agent mutates the winner and cross-breeds strong sections across parents. Every change carries a changelog entry citing the specific evidence that motivated it.",
      href: "/evolution",
    },
  ];

  return (
    <PageShell
      active="/"
      title="Landing pages that improve themselves"
      subtitle="An autonomous experimentation loop for Scholé AI: persona agents simulate user behavior, a bandit compares variants, and optimizer agents breed better pages - generation after generation."
    >
      {run && overallBest && gen0Best && (
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          <Stat label="Simulated visits" value={totalVisits.toLocaleString()} />
          <Stat
            label="Best gen-0 conversion"
            value={`${(gen0Best.conversionRate * 100).toFixed(1)}%`}
            sub={gen0Best.variantId}
          />
          <Stat
            label={`Best gen-${lastGen!.generation} conversion`}
            value={`${(overallBest.conversionRate * 100).toFixed(1)}%`}
            sub={overallBest.variantId}
            highlight
          />
        </div>
      )}

      <div className="grid gap-4">
        {steps.map((s) => (
          <Link
            key={s.n}
            href={s.href}
            className="group flex gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition hover:border-indigo-500/50 hover:bg-slate-900"
          >
            <div className="text-2xl font-black text-slate-700 group-hover:text-indigo-400">
              {s.n}
            </div>
            <div>
              <h2 className="font-semibold text-white">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.body}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400">
          What this is - and isn&apos;t
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Simulated personas are a <em>prior</em>, not ground truth. They pre-test messaging before
          real traffic arrives, and their priors are designed to be corrected by reality: every
          page here is instrumented with PostHog, Google Tag Manager, and Microsoft Clarity
          (per-variant tags, CTA + scroll events), and persona parameters are recalibrated
          from live traffic via <code className="rounded bg-slate-800 px-1">data/calibration.json</code>. The claim is not &quot;LLMs replace users&quot; - it&apos;s
          that a system which learns from behavior can start learning before launch day.
        </p>
      </div>

      {run && lastGen && (
        <HomeLiveSection
          simulated={{
            conversionRate:
              lastGen.visits.filter((v) => v.converted).length / lastGen.visits.length,
            bounceRate:
              lastGen.visits.filter((v) => v.events.some((e) => e.type === "bounce")).length /
              lastGen.visits.length,
            avgScrollDepth:
              lastGen.visits.reduce((s, v) => s + v.scrollDepth, 0) / lastGen.visits.length,
          }}
        />
      )}
    </PageShell>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight ? "border-indigo-500/50 bg-indigo-500/10" : "border-slate-800 bg-slate-900/60"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      {sub && <div className="mt-0.5 font-mono text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
