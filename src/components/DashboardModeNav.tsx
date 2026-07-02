"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardModeNav() {
  const path = usePathname();
  const isLive = path.startsWith("/live");

  return (
    <div className="flex rounded-full border border-slate-200 bg-slate-100 p-1">
      <Link
        href="/"
        className={`rounded-full px-4 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${
          !isLive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        Simulation dashboard
      </Link>
      <Link
        href="/live"
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${
          isLive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        {isLive && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
        Live version
      </Link>
    </div>
  );
}
