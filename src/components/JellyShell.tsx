"use client";

import { usePathname } from "next/navigation";
import { JellyHeader } from "./JellyHeader";

export function JellyShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const showHeader = !path.startsWith("/v/");

  return (
    <>
      {showHeader && <JellyHeader />}
      {children}
    </>
  );
}
