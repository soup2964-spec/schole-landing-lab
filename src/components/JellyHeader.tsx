"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function JellyHeader() {
  const path = usePathname();
  const isLive = path.startsWith("/live");

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          Jelly
        </Link>

        <div className="flex rounded-full border border-slate-200 bg-slate-100 p-1">
          <Link
            href="/"
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              !isLive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Simulation
          </Link>
          <Link
            href="/live"
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              isLive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {isLive && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
            Live
          </Link>
        </div>
      </div>
    </header>
  );
}
