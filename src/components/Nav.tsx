"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CRITERIA } from "@/config/criteria";
import { DashboardModeNav } from "@/components/DashboardModeNav";

export function SimulationDashboardShell({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState("1");

  useEffect(() => {
    const sections = CRITERIA.map((c) => document.getElementById(`section-${c.id}`)).filter(
      Boolean
    ) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActive(visible.target.id.replace("section-", ""));
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5] }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div>
            <Link href="/" className="text-sm font-semibold text-slate-900">
              Scholé <span className="text-schole-primary">Landing Lab</span>
            </Link>
            <p className="text-[11px] text-slate-500">Simulation dashboard · 6 GTM criteria</p>
          </div>
          <DashboardModeNav />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-0 lg:gap-8 lg:px-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <nav className="sticky top-[57px] max-h-[calc(100vh-57px)] overflow-y-auto py-6 pr-2">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-schole-primary">
              Required deliverables
            </p>
            <ol className="space-y-1">
              {CRITERIA.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#section-${c.id}`}
                    className={`block rounded-xl border px-3 py-3 transition ${
                      active === c.id
                        ? "border-schole-primary bg-white shadow-md ring-1 ring-schole-primary/20"
                        : "border-transparent hover:border-slate-200 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          active === c.id
                            ? "bg-schole-primary text-white"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {c.id}
                      </span>
                      <div>
                        <div className="text-xs font-semibold leading-snug text-slate-900">
                          {c.title}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">{c.question}</div>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <div className="sticky top-[57px] z-40 flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          {CRITERIA.map((c) => (
            <a
              key={c.id}
              href={`#section-${c.id}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                active === c.id ? "bg-schole-primary text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {c.id}. {c.short}
            </a>
          ))}
        </div>

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-0 lg:py-8">{children}</main>
      </div>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Simulation dashboard · persona agents + bandit + optimizer
      </footer>
    </div>
  );
}

export function LiveDashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-emerald-200 bg-gradient-to-r from-emerald-50 to-white shadow-sm">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/live" className="text-sm font-semibold text-slate-900">
                Scholé <span className="text-schole-primary">Landing Lab</span>
              </Link>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Live version
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              Real traffic · PostHog · GTM · Clarity · auto-calibration loop
            </p>
          </div>
          <DashboardModeNav />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">{children}</main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Live version dashboard · closes the loop between real visitors and simulated personas
      </footer>
    </div>
  );
}

export function EmptyRun() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 className="text-lg font-semibold text-slate-900">No experiment data</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        Run <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run demo</code> to populate the
        simulation dashboard.
      </p>
    </div>
  );
}

/** @deprecated use SimulationDashboardShell */
export const DashboardShell = SimulationDashboardShell;
