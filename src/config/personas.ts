import type { PersonaSet } from "@/lib/schema/persona";

/**
 * Persona set v1 - priors sourced from published buyer research, not invented.
 * Sources cited per-attribute in `groundedIn`. This file is the swappable
 * calibration seam: v2+ versions are produced by the calibrator from real
 * PostHog / GTM traffic (see lib/calibration).
 *
 * Source key:
 *  [TalentLMS26]  TalentLMS 2026 L&D Benchmark Report
 *  [G2-LMS25]     G2 "Corporate LMS in 2025" review analysis
 *  [RiseUp]       Rise Up State of Learning Report (via TrainingZone, 2025)
 *  [ELI25]        eLearning Industry survey of 1,700+ L&D professionals (2025)
 *  [Docebo26]     Docebo AI Readiness Gap Report 2026
 *  [EUAIAct]      EU AI Act, Article 4 (AI literacy obligation, in force Feb 2025)
 *  [NNG]          Nielsen Norman Group scroll-behavior research
 */
export const PERSONA_SET_V1: PersonaSet = {
  version: 1,
  createdAt: "2026-07-01",
  changelog:
    "v1: priors grounded in published 2025-2026 buyer research (TalentLMS, G2, Rise Up, eLearning Industry, Docebo). Awaiting calibration from real Clarity traffic.",
  personas: [
    {
      id: "ld_director",
      version: 1,
      name: "Dana",
      role: "L&D Director, 2,000-person retail company",
      profile:
        "Runs learning programs but is excluded from budget conversations. Needs hard business-outcome evidence to defend her function to the CFO. Feature lists bore her; adoption and ROI numbers stop her scroll.",
      goals: [
        "Prove learning drives measurable business outcomes",
        "Get back in the room where budget decisions happen",
        "Move beyond completion-rate vanity metrics",
      ],
      objections: [
        {
          id: "roi_proof",
          text: "Can I put a number in front of my CFO, or is this another 'engagement' story?",
          critical: true,
          groundedIn:
            "[Docebo26] Fewer than half of learning leaders feel confident connecting learning to business results; [ELI25] 78% of L&D teams excluded from budget decisions.",
        },
        {
          id: "employee_adoption",
          text: "Our current LMS has a 30% completion rate. Why would this be different?",
          critical: true,
          groundedIn:
            "[G2-LMS25] Low completion driven by content disconnected from daily work and lengthy modules.",
        },
        {
          id: "price_clarity",
          text: "If I have to 'book a demo' to learn the price, I assume it's expensive.",
          critical: false,
          groundedIn:
            "[G2-LMS25] Price clarity is a recurring concern in LMS directory reviews.",
        },
      ],
      patienceSeconds: { mean: 75, stdDev: 20 },
      skepticism: 0.65,
      skimPropensity: 0.45,
      ctaPropensity: 0.55,
      trafficWeight: 0.22,
      groundedIn: [
        "[ELI25] 78% of L&D teams say they aren't in the room when budgets get decided",
        "[Docebo26] <50% of learning leaders confident connecting learning to business results",
      ],
    },
    {
      id: "hr_manager",
      version: 1,
      name: "Marcus",
      role: "HR Manager, 800-person logistics company",
      profile:
        "Believes his AI training program is working - his employees quietly disagree. Generic 'improve your training' pitches bounce off him; evidence of a hidden adoption gap lands hard because it names his blind spot.",
      goals: [
        "Show leadership the AI rollout is succeeding",
        "Close the gap between training delivered and skills applied",
      ],
      objections: [
        {
          id: "employee_adoption",
          text: "We already run AI training. My dashboards say it's fine.",
          critical: true,
          groundedIn:
            "[TalentLMS26] 83% of HR managers believe their company supports AI learning; only 64% of employees agree - a 19-point perception gap.",
        },
        {
          id: "roi_proof",
          text: "How do I see who's actually applying this, not just completing it?",
          critical: true,
          groundedIn:
            "[RiseUp] Outdated KPIs (completion rates) cited as a core barrier; 'time to skill' recommended instead.",
        },
        {
          id: "implementation_burden",
          text: "I don't have headcount for another platform rollout.",
          critical: false,
          groundedIn:
            "[RiseUp] 55% of L&D leaders say they lack skilled people to implement AI-driven learning.",
        },
      ],
      patienceSeconds: { mean: 60, stdDev: 15 },
      skepticism: 0.55,
      skimPropensity: 0.5,
      ctaPropensity: 0.5,
      trafficWeight: 0.2,
      groundedIn: [
        "[TalentLMS26] 19-point perception gap between HR managers and employees on AI learning support",
      ],
    },
    {
      id: "employee_ic",
      version: 1,
      name: "Priya",
      role: "Marketing specialist, individual contributor",
      profile:
        "Overloaded, skeptical of corporate training, and quietly worried that 'AI upskilling' is a euphemism for automating her role. Only converts on learning that visibly fits her workday and her actual tools.",
      goals: [
        "Get better at AI tools without losing hours of work time",
        "Stay employable as AI reshapes her role",
      ],
      objections: [
        {
          id: "time_cost",
          text: "I don't have 45 minutes for a course. I barely have 5.",
          critical: true,
          groundedIn:
            "[TalentLMS26] ~50% of employees and leaders say high workloads leave little room for training.",
        },
        {
          id: "automation_anxiety",
          text: "Is this training me, or training my replacement?",
          critical: true,
          groundedIn:
            "[TalentLMS26] 47% of leaders say AI training is designed partly to make jobs easier to automate; [ELI25] employees resist adoption that feels imposed on them.",
        },
        {
          id: "relevance_to_role",
          text: "Generic AI courses have nothing to do with my daily work.",
          critical: true,
          groundedIn:
            "[G2-LMS25] Unclear relevance to daily work is a top driver of learner disengagement.",
        },
      ],
      patienceSeconds: { mean: 35, stdDev: 12 },
      skepticism: 0.7,
      skimPropensity: 0.65,
      ctaPropensity: 0.45,
      trafficWeight: 0.18,
      groundedIn: [
        "[TalentLMS26] workload pressure + automation-anxiety findings",
        "[NNG] Short attention: ~57% of viewing time above the fold",
      ],
    },
    {
      id: "ops_it_buyer",
      version: 1,
      name: "Tomas",
      role: "Head of IT/Operations, evaluates all new tooling",
      profile:
        "Integration-scarred from two painful LMS rollouts. Scans pages for stack compatibility, data handling, and content-quality guarantees. A page that never mentions integration is a page he leaves.",
      goals: [
        "Avoid another integration nightmare",
        "Verify vendor content quality and security posture before anyone books a call",
      ],
      objections: [
        {
          id: "integration_friction",
          text: "Does this plug into our LMS, HRIS, and SSO, or is it another silo?",
          critical: true,
          groundedIn:
            "[G2-LMS25] Integration friction with organizational tools among top LMS complaints; [TalentLMS26] 24% of HR managers cite tech-integration difficulty.",
        },
        {
          id: "content_quality",
          text: "AI-generated lessons? Who checks them for accuracy?",
          critical: true,
          groundedIn:
            "[TalentLMS26] 22% cite unreliable AI-generated content as an adoption blocker.",
        },
        {
          id: "implementation_burden",
          text: "What's the real go-live time - weeks or quarters?",
          critical: false,
          groundedIn:
            "[G2-LMS25] Buyers now expect ~2.8-month go-live and ~10-month ROI.",
        },
      ],
      patienceSeconds: { mean: 55, stdDev: 15 },
      skepticism: 0.75,
      skimPropensity: 0.55,
      ctaPropensity: 0.4,
      trafficWeight: 0.15,
      groundedIn: [
        "[G2-LMS25] integration friction + admin burden are dominant complaint themes",
      ],
    },
    {
      id: "ld_team_lead",
      version: 1,
      name: "Sofia",
      role: "L&D Team Lead, 4-person team, no AI specialists",
      profile:
        "Wants AI-driven learning but her team is small, stretched, and non-technical. Complexity is her enemy; 'no specialists needed, live in weeks' is her love language. Fears buying something her team can't run.",
      goals: [
        "Modernize learning without hiring AI engineers",
        "Reduce admin/reporting time, not add to it",
      ],
      objections: [
        {
          id: "implementation_burden",
          text: "We can't implement AI-driven learning - we don't have the people.",
          critical: true,
          groundedIn:
            "[RiseUp] 62% of L&D leaders cite lack of AI knowledge as their biggest barrier; 55% lack skilled people.",
        },
        {
          id: "roi_proof",
          text: "Reporting on our current platform eats my week. Will this make that worse?",
          critical: true,
          groundedIn:
            "[G2-LMS25] Time-consuming reporting and module setup among most-cited pain points (71 mentions).",
        },
        {
          id: "credibility",
          text: "Every vendor slapped 'AI' on their homepage this year. Why trust this one?",
          critical: false,
          groundedIn:
            "[Docebo26] Learning leaders under pressure to separate real AI capability from rebranding.",
        },
      ],
      patienceSeconds: { mean: 70, stdDev: 18 },
      skepticism: 0.6,
      skimPropensity: 0.4,
      ctaPropensity: 0.6,
      trafficWeight: 0.15,
      groundedIn: [
        "[RiseUp] AI knowledge gap + talent shortage findings",
      ],
    },
    {
      id: "compliance_lead",
      version: 1,
      name: "Anneke",
      role: "Head of People, EU-headquartered fintech",
      profile:
        "Has a dated regulatory obligation: EU AI Act Article 4 requires demonstrable AI literacy across her workforce. She needs coverage, auditability, and speed - and she's comparing three vendors this week.",
      goals: [
        "Satisfy EU AI Act Article 4 with auditable evidence",
        "Roll out AI literacy to 1,200 employees this quarter",
      ],
      objections: [
        {
          id: "compliance_coverage",
          text: "Does this actually map to Article 4 requirements, or is 'compliance' a marketing word here?",
          critical: true,
          groundedIn:
            "[EUAIAct] Article 4 AI-literacy obligation applies to providers and deployers from Feb 2025.",
        },
        {
          id: "roi_proof",
          text: "I need audit-ready reporting per employee, not a completion certificate.",
          critical: true,
          groundedIn:
            "[G2-LMS25] Compliance dashboards adequate but advanced analytics depth a common gap.",
        },
        {
          id: "implementation_burden",
          text: "This quarter. Can it be live this quarter?",
          critical: false,
          groundedIn: "[G2-LMS25] go-live time expectations (~2.8 months avg).",
        },
      ],
      patienceSeconds: { mean: 50, stdDev: 12 },
      skepticism: 0.5,
      skimPropensity: 0.5,
      ctaPropensity: 0.7,
      trafficWeight: 0.1,
      groundedIn: ["[EUAIAct] Article 4 creates dated, non-optional demand"],
    },
  ],
};
