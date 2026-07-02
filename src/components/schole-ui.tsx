import Link from "next/link";
import { CRITERIA } from "@/config/criteria";

/** Shared Scholé design primitives for the lab dashboard. */

export const schole = {
  card: "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
  cardMuted: "rounded-xl border border-slate-200 bg-slate-50 p-5",
  cardHighlight: "rounded-xl border-2 border-schole-primary/40 bg-schole-primary/5 p-5",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full bg-schole-primary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-schole-primary-hover",
  btnSecondary:
    "inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50",
  code: "rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700",
} as const;

export function ChallengeSection({
  n,
  title,
  subtitle,
  children,
}: {
  n: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const meta = CRITERIA.find((c) => c.id === n);

  return (
    <section
      id={`section-${n}`}
      className="scroll-mt-28 mb-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm last:mb-0"
    >
      {/* Magenta rubric header band */}
      <div className="border-b border-schole-primary/20 bg-gradient-to-r from-schole-primary/10 via-white to-white px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-schole-primary text-2xl font-bold text-white shadow-lg shadow-schole-primary/25">
            {n}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-schole-primary">
              Criterion {n} of 6
              {meta ? ` · ${meta.short}` : ""}
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-slate-900 md:text-2xl">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="border-l-4 border-schole-primary px-6 py-6">{children}</div>
    </section>
  );
}

export function StatCard({
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
    <div className={highlight ? schole.cardHighlight : schole.card}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-schole-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 font-mono text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
