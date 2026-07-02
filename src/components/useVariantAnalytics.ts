"use client";

import { useEffect, useRef } from "react";
import type { VariantContext } from "@/lib/analytics/track";
import {
  identifyVariant,
  trackBounce,
  trackScrollDepth,
} from "@/lib/analytics/track";

const MILESTONES = [25, 50, 75, 100];

/**
 * Instruments a variant page (or iframe document) with scroll-depth milestones
 * and exit events — the signals PostHog/GTM use to calibrate simulated personas.
 */
export function useVariantAnalytics(
  ctx: VariantContext,
  scrollRoot?: HTMLElement | null
) {
  const fired = useRef(new Set<number>());
  const maxScroll = useRef(0);
  const startMs = useRef(Date.now());

  useEffect(() => {
    fired.current = new Set();
    maxScroll.current = 0;
    startMs.current = Date.now();
    identifyVariant(ctx);
  }, [ctx.variantId, ctx.generation, ctx.strategy]);

  useEffect(() => {
    const root = scrollRoot ?? document.documentElement;
    const getScrollable = () => (scrollRoot ? scrollRoot : document.documentElement);
    const getDepth = () => {
      const el = getScrollable();
      const scrollTop = scrollRoot ? el.scrollTop : window.scrollY;
      const scrollHeight = scrollRoot
        ? el.scrollHeight - el.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return 0;
      return Math.min(1, scrollTop / scrollHeight);
    };

    const onScroll = () => {
      const depth = getDepth();
      maxScroll.current = Math.max(maxScroll.current, depth);
      const pct = Math.round(depth * 100);
      for (const m of MILESTONES) {
        if (pct >= m && !fired.current.has(m)) {
          fired.current.add(m);
          trackScrollDepth(ctx, m);
        }
      }
    };

    const target = scrollRoot ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const onExit = () => {
      trackBounce(ctx, maxScroll.current, Date.now() - startMs.current);
    };
    window.addEventListener("pagehide", onExit);

    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onExit);
    };
  }, [ctx, scrollRoot]);
}
