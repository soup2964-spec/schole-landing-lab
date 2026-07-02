"use client";

import { useEffect, useRef, useState } from "react";
import { ClarityVariantTag, trackCtaClick } from "./Clarity";
import { useVariantAnalytics } from "./useVariantAnalytics";

/**
 * Exact replica of schole.ai's Framer landing page, served from /baseline/index.html.
 * Section markers (data-section-id) are injected at build time for replay + simulation.
 */
export function ScholeBaselineReplica({
  variantId,
  generation,
  highlightSectionId,
  iframeClassName = "h-screen w-full border-0",
  showLabChrome = true,
}: {
  variantId: string;
  generation: number;
  highlightSectionId?: string;
  iframeClassName?: string;
  showLabChrome?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const ctx = { variantId, generation, strategy: "baseline" as const };

  useVariantAnalytics(ctx, scrollRoot);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      setScrollRoot(doc.documentElement);

      doc.querySelectorAll('a[href*="cal.com"], a[href*="demo"]').forEach((el) => {
        el.addEventListener("click", () => trackCtaClick(ctx, "cta"));
      });
    };

    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [variantId, generation]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    doc.querySelectorAll("[data-section-id].ll-highlight").forEach((el) => {
      el.classList.remove("ll-highlight");
    });

    if (!highlightSectionId) return;

    const target = doc.querySelector(`[data-section-id="${highlightSectionId}"]`);
    if (target) {
      target.classList.add("ll-highlight");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightSectionId]);

  return (
    <div className="relative min-h-screen bg-white">
      <ClarityVariantTag variantId={variantId} generation={generation} strategy="baseline" />
      {showLabChrome && (
        <div className="pointer-events-none absolute left-4 top-4 z-50 flex items-center gap-2">
          <span className="pointer-events-auto rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
            Landing Lab · Baseline replica
          </span>
          <a
            href="/variants"
            className="pointer-events-auto rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            All variants
          </a>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/baseline/index.html"
        title="Scholé AI — baseline landing page"
        className={iframeClassName}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
}
