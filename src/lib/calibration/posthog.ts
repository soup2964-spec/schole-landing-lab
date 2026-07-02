import type { RealMetricsSnapshot, VariantRealMetrics } from "./types";

const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com";
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

interface HogQLResponse {
  results?: unknown[][];
  columns?: string[];
  error?: string;
}

/**
 * Pull per-variant aggregates from PostHog (same stack schole.ai uses).
 * Requires a personal API key with query access.
 */
export async function fetchPostHogMetrics(windowDays = 30): Promise<RealMetricsSnapshot | null> {
  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) return null;

  const query = `
    SELECT
      properties.variant_id AS variant_id,
      count(DISTINCT person_id) AS visitors,
      countIf(event = 'cta_click') AS cta_clicks,
      avgIf(toFloat(properties.scroll_depth_pct), event = 'scroll_depth') / 100 AS avg_scroll,
      countIf(event = 'page_exit' AND toFloat(properties.scroll_depth) < 0.15) AS bounces,
      countIf(event IN ('$pageview', 'variant_page_view') OR event = 'page_exit') AS sessions
    FROM events
    WHERE timestamp >= now() - INTERVAL ${windowDays} DAY
      AND properties.source = 'landing_lab'
      AND properties.variant_id IS NOT NULL
    GROUP BY variant_id
  `;

  const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${POSTHOG_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query },
    }),
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog query failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as HogQLResponse;
  if (data.error) throw new Error(data.error);

  const rows = data.results ?? [];
  const byVariant: VariantRealMetrics[] = rows
    .map((row) => {
      const [variantId, visitors, ctaClicks, avgScroll, bounces, sessions] = row as [
        string,
        number,
        number,
        number | null,
        number,
        number,
      ];
      const v = Number(visitors) || 0;
      const clicks = Number(ctaClicks) || 0;
      const sess = Number(sessions) || v || 1;
      return {
        variantId: String(variantId),
        visitors: v,
        ctaClicks: clicks,
        conversionRate: v > 0 ? clicks / v : 0,
        avgScrollDepth: avgScroll != null && !Number.isNaN(avgScroll) ? avgScroll : 0.45,
        bounceRate: sess > 0 ? (Number(bounces) || 0) / sess : 0.5,
      };
    })
    .filter((m) => m.variantId && m.variantId !== "null");

  const totalVisitors = byVariant.reduce((s, m) => s + m.visitors, 0);
  const totalClicks = byVariant.reduce((s, m) => s + m.ctaClicks, 0);

  return {
    fetchedAt: new Date().toISOString(),
    source: "posthog",
    windowDays,
    byVariant,
    aggregate: {
      visitors: totalVisitors,
      conversionRate: totalVisitors > 0 ? totalClicks / totalVisitors : 0,
      avgScrollDepth:
        byVariant.length > 0
          ? byVariant.reduce((s, m) => s + m.avgScrollDepth * m.visitors, 0) /
            Math.max(1, totalVisitors)
          : 0,
      bounceRate:
        byVariant.length > 0
          ? byVariant.reduce((s, m) => s + m.bounceRate * m.visitors, 0) /
            Math.max(1, totalVisitors)
          : 0,
    },
  };
}
