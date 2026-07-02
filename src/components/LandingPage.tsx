"use client";

import type { PageVariant, Section } from "@/lib/schema/page";
import { ClarityVariantTag, trackCtaClick } from "./Clarity";
import { ScholeBaselineReplica } from "./ScholeBaselineReplica";
import { useVariantAnalytics } from "./useVariantAnalytics";

function VariantAnalytics({ variant }: { variant: PageVariant }) {
  useVariantAnalytics({
    variantId: variant.id,
    generation: variant.generation,
    strategy: variant.strategy,
  });
  return null;
}

/**
 * Renders a PageVariant as a real landing page. Every section carries
 * data-section-id so the replay theater can scroll/highlight it.
 */

function CtaButton({
  label,
  variant,
  sectionId,
  big,
}: {
  label: string;
  variant: PageVariant;
  sectionId: string;
  big?: boolean;
}) {
  return (
    <button
      onClick={() =>
        trackCtaClick(
          {
            variantId: variant.id,
            generation: variant.generation,
            strategy: variant.strategy,
          },
          sectionId
        )
      }
      className={`inline-block rounded-full bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 hover:shadow-indigo-500/30 ${
        big ? "px-8 py-4 text-lg" : "px-6 py-3 text-sm"
      }`}
    >
      {label}
    </button>
  );
}

function SectionBlock({
  section,
  variant,
  highlight,
}: {
  section: Section;
  variant: PageVariant;
  highlight?: boolean;
}) {
  const s = section;
  const base = highlight ? "ring-4 ring-amber-400 ring-offset-4" : "";

  switch (s.type) {
    case "hero":
      return (
        <header
          data-section-id={s.id}
          className={`bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900 px-6 py-24 text-center text-white ${base}`}
        >
          <div className="mx-auto max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-indigo-300">
              Scholé AI
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              {s.headline}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-indigo-100/90">{s.body}</p>
            {s.ctaLabel && (
              <div className="mt-8">
                <CtaButton label={s.ctaLabel} variant={variant} sectionId={s.id} big />
              </div>
            )}
          </div>
        </header>
      );

    case "cta":
      return (
        <section
          data-section-id={s.id}
          className={`bg-indigo-600 px-6 py-20 text-center text-white ${base}`}
        >
          <div className="mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold">{s.headline}</h2>
            <p className="mt-4 text-indigo-100">{s.body}</p>
            {s.ctaLabel && (
              <div className="mt-8">
                <button
                  onClick={() =>
                    trackCtaClick(
                      {
                        variantId: variant.id,
                        generation: variant.generation,
                        strategy: variant.strategy,
                      },
                      s.id
                    )
                  }
                  className="rounded-full bg-white px-8 py-4 text-lg font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
                >
                  {s.ctaLabel}
                </button>
              </div>
            )}
          </div>
        </section>
      );

    case "problem":
      return (
        <section data-section-id={s.id} className={`bg-slate-900 px-6 py-20 text-white ${base}`}>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-amber-400">{s.headline}</h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">{s.body}</p>
          </div>
        </section>
      );

    case "social_proof":
      return (
        <section data-section-id={s.id} className={`bg-indigo-50 px-6 py-20 ${base}`}>
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-3xl font-bold text-slate-900">{s.headline}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg italic text-slate-700">
              {s.body}
            </p>
            {s.items && (
              <div className="mt-10 grid gap-6 md:grid-cols-2">
                {s.items.map((it) => (
                  <blockquote
                    key={it.title}
                    className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm"
                  >
                    <p className="text-slate-700">{it.detail}</p>
                    <footer className="mt-4 text-sm font-semibold text-indigo-700">
                      {it.title}
                    </footer>
                  </blockquote>
                ))}
              </div>
            )}
          </div>
        </section>
      );

    case "credibility":
      return (
        <section data-section-id={s.id} className={`bg-white px-6 py-20 ${base}`}>
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold text-slate-900">{s.headline}</h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg text-slate-600">{s.body}</p>
            {s.items && (
              <div className="mt-10 grid gap-6 text-left md:grid-cols-2">
                {s.items.map((it) => (
                  <div key={it.title} className="rounded-2xl bg-slate-50 p-6">
                    <h3 className="font-semibold text-slate-900">{it.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{it.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );

    case "compliance":
      return (
        <section data-section-id={s.id} className={`bg-slate-50 px-6 py-20 ${base}`}>
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
              EU AI Act · Article 4
            </div>
            <h2 className="text-3xl font-bold text-slate-900">{s.headline}</h2>
            <p className="mt-4 text-lg italic text-slate-600">{s.body}</p>
            {s.items && (
              <div className="mt-8 space-y-4">
                {s.items.map((it) => (
                  <div
                    key={it.title}
                    className="flex gap-4 rounded-xl border border-emerald-200 bg-white p-5"
                  >
                    <div className="mt-1 h-5 w-5 flex-none rounded-full bg-emerald-500 text-center text-xs font-bold leading-5 text-white">
                      ✓
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{it.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{it.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );

    case "outcomes":
      return (
        <section data-section-id={s.id} className={`bg-white px-6 py-20 ${base}`}>
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold text-slate-900">{s.headline}</h2>
            <p className="mt-4 text-lg text-slate-600">{s.body}</p>
            {s.items && (
              <div className="mt-10 grid gap-6 md:grid-cols-3">
                {s.items.map((it) => (
                  <div
                    key={it.title}
                    className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-sm"
                  >
                    <h3 className="font-semibold text-indigo-700">{it.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{it.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );

    case "integration":
      return (
        <section data-section-id={s.id} className={`bg-slate-100 px-6 py-16 ${base}`}>
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-bold text-slate-900">{s.headline}</h2>
            <p className="max-w-2xl text-slate-600">{s.body}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs font-semibold text-slate-500">
              {["LMS", "HRIS", "SSO", "Slack", "Notion", "Excel"].map((t) => (
                <span key={t} className="rounded-full border border-slate-300 bg-white px-3 py-1">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>
      );

    case "faq":
      return (
        <section data-section-id={s.id} className={`bg-white px-6 py-20 ${base}`}>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-slate-900">{s.headline}</h2>
            <p className="mt-4 text-slate-600">{s.body}</p>
            {s.items && (
              <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200">
                {s.items.map((it) => (
                  <div key={it.title} className="p-5">
                    <h3 className="font-semibold text-slate-900">{it.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{it.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );

    // features, how_it_works, product_tour share a card layout
    default:
      return (
        <section data-section-id={s.id} className={`bg-white px-6 py-20 ${base}`}>
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold text-slate-900">{s.headline}</h2>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">{s.body}</p>
            {s.items && (
              <div className="mt-10 grid gap-6 md:grid-cols-3">
                {s.items.map((it) => (
                  <div key={it.title} className="rounded-2xl bg-indigo-50/60 p-6">
                    <h3 className="font-semibold text-slate-900">{it.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{it.detail}</p>
                  </div>
                ))}
              </div>
            )}
            {s.ctaLabel && (
              <div className="mt-8">
                <CtaButton label={s.ctaLabel} variant={variant} sectionId={s.id} />
              </div>
            )}
          </div>
        </section>
      );
  }
}

export function LandingPage({
  variant,
  highlightSectionId,
}: {
  variant: PageVariant;
  highlightSectionId?: string;
}) {
  if (variant.strategy === "baseline") {
    return (
      <ScholeBaselineReplica
        variantId={variant.id}
        generation={variant.generation}
        highlightSectionId={highlightSectionId}
        iframeClassName={
          highlightSectionId !== undefined
            ? "h-[520px] w-full border-0"
            : "h-screen w-full border-0"
        }
        showLabChrome={highlightSectionId === undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <VariantAnalytics variant={variant} />
      <ClarityVariantTag
        variantId={variant.id}
        generation={variant.generation}
        strategy={variant.strategy}
      />
      {variant.sections.map((s) => (
        <SectionBlock
          key={s.id}
          section={s}
          variant={variant}
          highlight={highlightSectionId === s.id}
        />
      ))}
      <footer className="bg-slate-950 px-6 py-10 text-center text-xs text-slate-500">
        Scholé Inc. · 981 Mission Street #17, San Francisco · team@schole.ai
        <span className="mx-2">·</span>
        <span className="text-slate-600">
          Experiment variant {variant.id} · generation {variant.generation}
        </span>
      </footer>
    </div>
  );
}
