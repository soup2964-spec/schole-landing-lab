"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

function ClarityScript() {
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
  useEffect(() => {
    if (!clarityId || window.clarity) return;
    const script = document.createElement("script");
    script.innerHTML = `
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${clarityId}");
    `;
    document.head.appendChild(script);
  }, [clarityId]);
  return null;
}

function GtmScript() {
  useEffect(() => {
    if (!GTM_ID || document.getElementById("gtm-script")) return;

    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

    const script = document.createElement("script");
    script.id = "gtm-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.appendChild(script);
  }, []);
  return null;
}

function PostHogInit({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return;
    if ((posthog as { __loaded?: boolean }).__loaded) return;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: false, // variant pages fire their own tagged pageviews
      capture_pageleave: true,
    });
  }, []);

  if (!POSTHOG_KEY) return <>{children}</>;
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

/** Loads PostHog, Google Tag Manager, and optional Microsoft Clarity. */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  return (
    <PostHogInit>
      <ClarityScript />
      <GtmScript />
      {GTM_ID && (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
      )}
      {children}
    </PostHogInit>
  );
}
