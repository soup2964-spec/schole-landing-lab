import Link from "next/link";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/variants", label: "1 · Variants" },
  { href: "/experiment", label: "2 · Method" },
  { href: "/behavior", label: "3 · Behavior" },
  { href: "/results", label: "4 · Results" },
  { href: "/evolution", label: "5 · Evolution" },
];

export function Nav({ active }: { active: string }) {
  return (
    <nav className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-3">
        <Link href="/" className="mr-4 flex-none text-sm font-bold tracking-tight text-white">
          Landing<span className="text-indigo-400">Lab</span>
          <span className="ml-2 hidden text-xs font-normal text-slate-500 sm:inline">
            for Scholé AI
          </span>
        </Link>
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-none rounded-full px-3 py-1.5 text-xs font-medium transition ${
              active === t.href
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function PageShell({
  active,
  title,
  subtitle,
  wide,
  children,
}: {
  active: string;
  title: string;
  subtitle: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Nav active={active} />
      <main className={`mx-auto px-4 py-10 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>
        <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-slate-400">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </main>
      <footer className="border-t border-slate-900 px-4 py-8 text-center text-xs text-slate-600">
        LandingLab · autonomous landing page experimentation · built for the Scholé AI GTM challenge
      </footer>
    </div>
  );
}

export function EmptyRun() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
      <h2 className="text-lg font-semibold text-white">No experiment run yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
        Set <code className="rounded bg-slate-800 px-1.5 py-0.5">OPENAI_API_KEY</code> in{" "}
        <code className="rounded bg-slate-800 px-1.5 py-0.5">.env.local</code> and run{" "}
        <code className="rounded bg-slate-800 px-1.5 py-0.5">npm run experiment</code> to simulate
        visits, evaluate variants, and breed new generations. Results are written to{" "}
        <code className="rounded bg-slate-800 px-1.5 py-0.5">data/run.json</code>.
      </p>
    </div>
  );
}
