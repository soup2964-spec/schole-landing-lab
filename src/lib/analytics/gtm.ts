declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** Push a custom event to Google Tag Manager's dataLayer (forwards to GA4, Ads, etc.). */
export function pushDataLayer(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...payload });
}

export function pushPageContext(payload: Record<string, unknown>) {
  pushDataLayer("landing_lab_context", payload);
}
