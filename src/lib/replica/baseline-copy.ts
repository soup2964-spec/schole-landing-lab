/** Section ids injected into the Framer HTML — must match prepare-baseline-html.ts */
export const REPLICA_SECTION_IDS = [
  "hero",
  "how",
  "problem",
  "features",
  "tour",
  "proof",
  "press",
  "faq",
  "cta",
] as const;

export type ReplicaSectionId = (typeof REPLICA_SECTION_IDS)[number];

/**
 * Exact strings from public/baseline/index.html used as replacement anchors.
 * Variants swap these in-place; layout, styles, and images stay identical.
 */
export const BASELINE_HTML_COPY: Record<
  ReplicaSectionId,
  { headline?: string[]; body?: string[]; cta?: string; items?: string[] }
> = {
  hero: {
    headline: ["Faster competency. Higher engagement.", "Agentic Learning with Scholé."],
    body: [
      "Scholé uses the best of AI to construct exactly the right lesson for each learner. It's targeted, practical, and built on 10+ years of AI for education research from EPFL and UC Berkeley.",
    ],
    cta: "Book a demo",
  },
  how: {
    headline: ["Learn the new way with"],
    body: [
      "Scholé is a multi-agent pedagogical engine for adaptive and personalized learning.",
      "No more one-size-fits-all courses.",
    ],
  },
  problem: {
    headline: ["The adoption gap is real.", "Scholé closes it."],
    body: [
      "Scholé helps every employee understand why AI is relevant to their role.",
    ],
  },
  features: {
    headline: ["Learning that adapts to each person"],
    body: [
      "Every employee follows a path built around their tools, skills, and pace. The lesson content adjusts in real time as they progress.",
    ],
    items: [
      "Content tied to daily work",
      "Every lesson maps to the learner's actual tools (Notion, Excel, PowerPoint) and job function. They see immediately how their learning applies to their role.",
      "Measurable outcomes",
    ],
  },
  tour: {
    headline: ["What your employees get"],
    body: [
      "Targeted learning that fits into the workday and helps employees work faster and better with AI.",
      "An AI tutor team that adjusts to each learner",
      "Olé reads each learner's level in real time and responds accordingly, never too easy, never too hard.",
    ],
  },
  proof: {
    headline: ["Teams at these organizations are already learning on"],
    body: ["Decathlon Switzerland and the Harvard Data Science Initiative use Scholé today."],
  },
  press: {
    headline: ["Backed by the best.", "featured in the press"],
    body: [
      "Recognized by the world's leading AI & education institutions including UC Berkeley, EPFL, Harvard, DARPA, and InnoSuisse.",
    ],
  },
  faq: {
    headline: ["How is Scholé different from platforms like Coursera or LinkedIn Learning?"],
    body: ["How is Scholé different from platforms like ChatGPT?"],
  },
  cta: {
    headline: ["Ready to turn AI tools"],
    body: [
      "Whether you're preparing for the EU AI Act or want your teams to use AI with clarity and confidence, Scholé helps you move from awareness to measurable adoption.",
    ],
    cta: "Book a demo",
  },
};

/** Mid-page copy used by the live site — promoted to hero on v3-problem. */
export const ADOPTION_GAP_HERO = {
  line1: "Most companies have AI.",
  line2: "Very few turn it into",
  line3: "measurable impact.",
} as const;
