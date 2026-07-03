import type { PageVariant, Section, ChangelogEntry } from "@/lib/schema/page";
import type { VariantMetrics } from "@/lib/schema/events";
import type { GenerationReport } from "@/lib/schema/experiment";
import { GENERATION_0 } from "@/config/variants";
import { chatJSONRetry, breederProvider } from "@/lib/llm";
import { variantNameForBreeding } from "@/lib/variants/display-name";

/**
 * Optimizer agent: breeds the next generation from the evaluator's report.
 * Two genetic operations:
 *  - MUTATION: rewrite the weak sections of the fittest variant
 *  - CROSSOVER: combine the best-performing sections across different parents
 * Every change must carry a changelog entry citing specific evidence.
 */

const VALID_SECTION_TYPES = [
  "hero", "problem", "how_it_works", "features", "outcomes", "social_proof",
  "credibility", "compliance", "product_tour", "integration", "pricing", "faq", "cta",
];

const VALID_OBJECTIONS = [
  "roi_proof", "employee_adoption", "integration_friction", "content_quality",
  "implementation_burden", "time_cost", "automation_anxiety", "relevance_to_role",
  "compliance_coverage", "credibility", "price_clarity",
];

/** Section types the breeder may rewrite; tour and below stay baseline on live pages. */
const BRED_OWNED_SECTION_TYPES = new Set([
  "hero",
  "problem",
  "how_it_works",
  "features",
  "outcomes",
]);

const FROZEN_BASELINE_SECTION_IDS = new Set([
  "tour",
  "proof",
  "press",
  "faq",
  "cta",
]);

export interface BreedingAngle {
  key: string;
  /** Becomes the offspring page name — mirrors the base preview angles. */
  name: string;
  strategy: PageVariant["strategy"];
  persona: string;
  brief: string;
}

/**
 * Strategic angles taken directly from the base preview variants. Each offspring
 * in a generation is pinned to one angle so the batch explores distinct bets
 * instead of converging on a single narrative. The offspring's page name is set
 * to the angle name so the six pages read as the base preview's angles, improved
 * by behavioral evidence rather than replaced by it.
 */
export const BREEDING_ANGLES: BreedingAngle[] = [
  {
    key: "roi",
    name: "HR & L&D buyer (dashboard-led)",
    strategy: "roi",
    persona: "HR and L&D leaders who must defend budget",
    brief:
      "Lead with the HR/adoption dashboard and hard ROI: adoption rate, mastery, time to skill, numbers a CFO respects. Commit fully to this ROI angle and use the behavioral evidence to strengthen it. Do not drift into compliance or learner self serve.",
  },
  {
    key: "compliance",
    name: "EU compliance lead (AI Act-led)",
    strategy: "compliance",
    persona: "EU compliance and risk leads",
    brief:
      "Lead with EU AI Act Article 4 literacy as mandatory and auditable: per employee evidence and an exportable audit trail. Commit to this compliance angle even if it did not top fitness. Make it the strongest possible compliance page using the evidence.",
  },
  {
    key: "problem_first",
    name: "Executive adoption gap (problem-first)",
    strategy: "problem_first",
    persona: "executives staring at the AI adoption gap",
    brief:
      "Lead with the adoption gap problem in the executive's own numbers (licenses active, behavior unchanged), agitating the gap before the solution. Commit to this problem first angle.",
  },
  {
    key: "credibility",
    name: "Technical evaluator (research + integration)",
    strategy: "credibility",
    persona: "technical evaluators and IT gatekeepers",
    brief:
      "Lead with research pedigree (EPFL, UC Berkeley, peer reviewed knowledge tracing) and integration answers (LMS and HRIS). Commit to this credibility angle for the skeptical technical buyer.",
  },
  {
    key: "learner_first",
    name: "Employee self-serve (learner-first)",
    strategy: "learner_first",
    persona: "individual employees",
    brief:
      "Lead with the individual learner experience (the Ole tutor, 2 minute lessons tied to their own tools) and a self serve, no demo CTA. Commit to this learner first angle.",
  },
  {
    key: "generalist",
    name: "Generalist (full schole.ai story)",
    strategy: "baseline",
    persona: "a mixed buying committee",
    brief:
      "Tell the full balanced schole.ai story for a mixed buying committee: value, proof, and a clear demo CTA, without over indexing on any single objection. Commit to this generalist angle.",
  },
];

export function angleForChild(childIndex: number): BreedingAngle {
  return BREEDING_ANGLES[childIndex % BREEDING_ANGLES.length];
}

/** Remove em/en dashes and hyphens from customer-facing copy. */
function stripDashesFromCopy(text: string): string {
  return text
    .replace(/[—–]/g, ", ")
    .replace(/(\S)-(\S)/g, "$1 $2")
    .replace(/\s*-\s*/g, " ")
    .replace(/,\s*,+/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const SYSTEM = `You are a landing page optimizer for Scholé AI (B2B adaptive AI-upskilling platform). You breed improved landing page variants from experiment evidence.

You will receive: parent page definitions, their metrics, the analyst's report, and the biggest unresolved buyer objections. Produce ONE new page variant.

Hard rules:
- Every section needs: id (short slug), type (one of: ${VALID_SECTION_TYPES.join(", ")}), headline, body, optional items [{title, detail}], optional ctaLabel, addresses (array of objection ids from: ${VALID_OBJECTIONS.join(", ")}), readSeconds (8-25, honest estimate).
- "addresses" must be honest: only list objections the section's content substantively answers.
- Ground every change in the evidence. If the data says personas bounced with integration_friction unresolved, ADD content that actually resolves it - don't just tweak adjectives.
- Keep what worked (high dwell, high sentiment, sections cited in conversions). Cut or rewrite what didn't (high exit rate, low read rate, negative sentiment).
- Stay truthful to the product. Do not invent case studies, customers, or statistics that weren't in the parent pages. You may restructure, reframe, and reprioritize freely.
- Never use dashes in customer-facing copy: no hyphens (-), en dashes (–), or em dashes (—) in name, thesis, headlines, body, item titles, item details, or ctaLabel. Rephrase with commas, periods, or separate sentences instead (e.g. write "one size fits all" not "one-size-fits-all", "built for teams" not "built for teams — fast").
- Each offspring in a batch of six must be visually distinct: unique hero headline, unique strategic angle, and at least three sections meaningfully different from every sibling. Never clone a parent's hero or repeat the same headline as another offspring.
- 4-5 sections only: hero, problem, how_it_works, features, and/or outcomes. Do NOT write product_tour, social_proof, credibility, compliance, faq, cta, pricing, or integration sections. The live page keeps the baseline Framer blocks from "What your Employees Get" downward unchanged.
- The changelog must have 4-8 entries, each: {what, why, evidence, sourceVariantId?}. Evidence must cite specific numbers or quotes from the report. Use sourceVariantId when importing a section idea from another parent.

Return JSON exactly:
{"name": string (short descriptive name),
 "thesis": string (one paragraph: the strategic bet this page makes and what evidence motivated it),
 "ctaGoal": string,
 "sections": [...],
 "changelog": [...]}`;

interface OptimizerOutput {
  name: string;
  thesis: string;
  ctaGoal: string;
  sections: Section[];
  changelog: ChangelogEntry[];
}

export async function breedVariant(
  mode: "mutation" | "crossover",
  parents: PageVariant[],
  metrics: VariantMetrics[],
  report: GenerationReport,
  generation: number,
  childIndex: number,
  angle?: BreedingAngle,
  verdictBlock?: string
): Promise<PageVariant> {
  const parentBlock = parents
    .map((p) => {
      const m = metrics.find((x) => x.variantId === p.id);
      const sections = p.sections
        .map((s) => {
          const ps = m?.perSection.find((x) => x.sectionId === s.id);
          const items = s.items?.map((it) => `      * ${it.title}: ${it.detail}`).join("\n") ?? "";
          return `  [${s.id}] (${s.type}, addresses: ${s.addresses.join("/") || "none"}) "${s.headline}"
    ${s.body}${items ? "\n" + items : ""}${s.ctaLabel ? `\n    [BUTTON: ${s.ctaLabel}]` : ""}
    METRICS: readRate=${ps ? (ps.reads / Math.max(1, ps.views)).toFixed(2) : "?"} sentiment=${ps?.avgSentiment.toFixed(2) ?? "?"} exitRate=${ps ? (ps.exitRate * 100).toFixed(0) + "%" : "?"}`;
        })
        .join("\n");
      return `PARENT ${p.id} "${p.name}" - conversion ${(m?.conversionRate ?? 0) * 100}%, fitness ${m?.fitness.toFixed(1)}
Funnel: ctaExposure ${((m?.funnel?.ctaExposureRate ?? 0) * 100).toFixed(0)}% ctaCTR ${((m?.funnel?.ctaClickThroughRate ?? 0) * 100).toFixed(0)}% demoRate ${((m?.funnel?.demoBookingRate ?? 0) * 100).toFixed(0)}%
Thesis: ${p.thesis}
Unresolved objections costing conversions: ${Object.entries(m?.objectionFailures ?? {}).sort((a, b) => b[1] - a[1]).map(([o, c]) => `${o}(${c})`).join(", ") || "none"}
${sections}`;
    })
    .join("\n\n");

  const findings = report.findings.map((f) => `- ${f.finding} [evidence: ${f.evidence}]`).join("\n");

  const modeInstr =
    mode === "mutation"
      ? `MODE: MUTATION. Start from the fittest parent (${parents[0].id}). Keep its winning sections, rewrite/replace/reorder the underperforming ones, and add content resolving the objections that cost it conversions.`
      : `MODE: CROSSOVER. Combine the strongest sections across ALL parents into one page with a coherent narrative arc. Use sourceVariantId in the changelog to credit each imported section.`;

  const angleBlock = angle
    ? `ANGLE ASSIGNMENT (authoritative)
This page MUST commit to one angle: "${angle.name}" (strategy: ${angle.strategy}).
Target audience: ${angle.persona}.
${angle.brief}
Use the behavioral evidence below to make this the strongest possible version of THIS angle. Do NOT converge on a different angle even if another scored higher — the goal is a distinct, testable variant, not a copy of the leader.

`
    : "";

  const verdictInstr = verdictBlock
    ? `SAMPLED VISITOR VERDICTS (verbatim — ground the copy in these reactions)
${verdictBlock}

`
    : "";

  const user = `GENERATION ${generation} EVIDENCE

${angleBlock}BEHAVIORAL FINDINGS
${findings}

BEHAVIORAL SUMMARY
${report.insights}

${parentBlock}

${verdictInstr}${modeInstr}

Produce the JSON for the new variant.`;

  const out = await chatJSONRetry<OptimizerOutput>(SYSTEM, user, {
    temperature: 0.7,
    maxTokens: 6000,
    // Override with LLM_BREEDER_PROVIDER to decouple from the reader model.
    provider: breederProvider(),
  });

  const id = `g${generation + 1}-${mode === "mutation" ? "mut" : "x"}${childIndex}`;
  return {
    id,
    name: angle ? variantNameForBreeding(angle, generation, childIndex) : stripDashesFromCopy(out.name),
    strategy: angle ? angle.strategy : "generated",
    generation: generation + 1,
    parentIds: parents.map((p) => p.id),
    ctaGoal: stripDashesFromCopy(out.ctaGoal || parents[0].ctaGoal),
    thesis: stripDashesFromCopy(out.thesis),
    changelog: (out.changelog ?? []).map((c) => ({
      ...c,
      what: stripDashesFromCopy(String(c.what)),
      why: stripDashesFromCopy(String(c.why)),
      evidence: stripDashesFromCopy(String(c.evidence)),
    })),
    sections: finalizeBredSections(sanitizeSections(out.sections, id)),
  };
}

function sanitizeSections(sections: Section[], variantId: string): Section[] {
  const seen = new Set<string>();
  return (sections ?? [])
    .filter((s) => s && s.headline && s.body)
    .map((s, i) => {
      let id = (s.id || `s${i}`).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 24) || `s${i}`;
      while (seen.has(id)) id = `${id}-${i}`;
      seen.add(id);
      return {
        id,
        type: VALID_SECTION_TYPES.includes(s.type) ? s.type : "features",
        headline: stripDashesFromCopy(String(s.headline)),
        body: stripDashesFromCopy(String(s.body)),
        items: s.items?.slice(0, 6).map((it) => ({
          title: stripDashesFromCopy(String(it.title)),
          detail: stripDashesFromCopy(String(it.detail)),
        })),
        ctaLabel: s.ctaLabel ? stripDashesFromCopy(String(s.ctaLabel)) : undefined,
        addresses: (s.addresses ?? []).filter((a) => VALID_OBJECTIONS.includes(a)),
        readSeconds: Math.min(25, Math.max(8, Number(s.readSeconds) || 12)),
      } as Section;
    });
}

/** Keep bred JSON aligned with HTML: LLM owns upper funnel; baseline owns tour and below. */
function finalizeBredSections(owned: Section[]): Section[] {
  const baseline = GENERATION_0[0];
  const upper = owned.filter((s) => BRED_OWNED_SECTION_TYPES.has(s.type));
  const frozen = baseline.sections.filter((s) =>
    FROZEN_BASELINE_SECTION_IDS.has(s.id)
  );
  return [...upper, ...frozen];
}

/** Jaccard similarity on headline word sets - crude but effective diversity guard. */
export function pageSimilarity(a: PageVariant, b: PageVariant): number {
  const words = (v: PageVariant) =>
    new Set(
      v.sections
        .flatMap((s) => `${s.headline} ${s.body}`.toLowerCase().split(/\W+/))
        .filter((w) => w.length > 4)
    );
  const wa = words(a);
  const wb = words(b);
  const inter = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union ? inter / union : 0;
}
