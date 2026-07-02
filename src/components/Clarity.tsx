"use client";

import { useEffect } from "react";
import { identifyVariant, trackCtaClick as trackCta } from "@/lib/analytics/track";

export { trackCta as trackCtaClick };

export function ClarityVariantTag({
  variantId,
  generation,
  strategy,
}: {
  variantId: string;
  generation: number;
  strategy: string;
}) {
  useEffect(() => {
    identifyVariant({ variantId, generation, strategy });
  }, [variantId, generation, strategy]);
  return null;
}

export { AnalyticsProvider as ClarityScript } from "@/components/AnalyticsProvider";
