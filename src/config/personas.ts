import type { PersonaSet } from "@/lib/schema/persona";

/**
 * Persona set v2 — priors sourced from independent tier-1 research, not invented.
 * Sources cited per-attribute in `groundedIn`. Swappable calibration seam:
 * v3+ produced by the calibrator from live PostHog / GTM traffic.
 *
 * Source key:
 *  [McKinsey25]   McKinsey Superagency in the Workplace (2025)
 *  [OECD25]       OECD Bridging the AI Skills Gap (2025)
 *  [WEF25]        World Economic Forum Future of Jobs Report (2025)
 *  [Gallup25]     Gallup Workforce Panel — AI use & manager support (2025)
 *  [LinkedIn25]   LinkedIn 2025 Workplace Learning Report
 *  [TrainingMag25] Training Magazine 2025 Training Industry Report
 *  [Fosway25]     Fosway Digital Learning Realities (2025, independent analyst)
 *  [EUAIAct]      EU AI Act, Article 4 (AI literacy obligation, in force Feb 2025)
 *  [NNG]          Nielsen Norman Group scroll-behavior research
 */
export const PERSONA_SET_V1: PersonaSet = {
  version: 2,
  createdAt: "2026-07-03",
  changelog:
    "v2: profiles, objections, and behavioral priors rewritten against McKinsey, OECD, WEF, Gallup, LinkedIn, Training Magazine, Fosway, and EUR-Lex. Removed Dana soft objection.",
  personas: [
    {
      id: "ld_director",
      version: 2,
      name: "Dana",
      role: "L&D Director, 2,000-person retail company",
      profile:
        "Influences purchasing but rarely owns the budget line (TrainingMag: 25% set budget, 64% recommend). Her CFO treats L&D as a cost center until she ties programs to skill gaps — the barrier 63% of employers name for transformation (WEF). Completion rates and 'engagement' scores don't survive finance review; capability and adoption data do.",
      goals: [
        "Tie learning programs to skill-gap closure the board already cares about",
        "Replace completion-rate reporting with adoption and capability evidence",
        "Win executive sponsorship with business-outcome language, not feature lists",
      ],
      objections: [
        {
          id: "roi_proof",
          text: "Skill gaps are stalling our AI rollout — what business metric does this move, not another completion badge?",
          critical: true,
          groundedIn:
            "[McKinsey25] 46% of leaders cite workforce skill gaps as a major AI barrier; [WEF25] 63% of employers name skill gaps the top barrier to business transformation.",
        },
        {
          id: "employee_adoption",
          text: "Our LMS gets ~30% completion because content isn't role-relevant. Why would this land differently?",
          critical: true,
          groundedIn:
            "[OECD25] Training supply targets specialists while most workers need role-relevant AI literacy; [WEF25] employers still lean on completion over capability metrics.",
        },
      ],
      patienceSeconds: { mean: 80, stdDev: 18 },
      skepticism: 0.68,
      skimPropensity: 0.42,
      ctaPropensity: 0.52,
      trafficWeight: 0.22,
      groundedIn: [
        "[TrainingMag25] Only 25% of training respondents set the budget; 64% influence purchasing",
        "[LinkedIn25] L&D must prove business impact to win executive sponsorship",
        "[WEF25] 85% of employers plan upskilling — but demand proof it works",
      ],
    },
    {
      id: "hr_manager",
      version: 2,
      name: "Marcus",
      role: "HR Manager, 800-person logistics company",
      profile:
        "Owns the AI training rollout and reports green completion dashboards. But Gallup finds 23% of employees don't even know if their org has an AI strategy — and McKinsey shows workers adopt gen AI faster than leaders expect. His metrics measure delivery, not whether anyone changed how they work. Manager support is the strongest adoption lever (Gallup), and he's the manager.",
      goals: [
        "Close the gap between training delivered and AI actually used on the job",
        "Give leadership honest adoption data, not just completion stats",
        "Enable frontline managers to support AI use without another platform rollout",
      ],
      objections: [
        {
          id: "employee_adoption",
          text: "We already bought AI training. Completion rates look fine — what am I missing?",
          critical: true,
          groundedIn:
            "[Gallup25] 23% of employees don't know whether their organization has an AI strategy; [McKinsey25] employees use gen AI more than leaders expect.",
        },
        {
          id: "roi_proof",
          text: "How do I see who's applying AI on the job, not just clicking through modules?",
          critical: true,
          groundedIn:
            "[WEF25] 39% of core worker skills expected to change by 2030; shift from completion rates to time-to-skill outcomes.",
        },
        {
          id: "implementation_burden",
          text: "I can't staff another six-month platform rollout on top of this.",
          critical: false,
          groundedIn:
            "[WEF25] 85% of employers prioritize upskilling but teams lack capacity to implement at pace.",
        },
      ],
      patienceSeconds: { mean: 55, stdDev: 14 },
      skepticism: 0.52,
      skimPropensity: 0.52,
      ctaPropensity: 0.48,
      trafficWeight: 0.2,
      groundedIn: [
        "[Gallup25] Manager support is the strongest predictor of employee AI adoption",
        "[McKinsey25] Nearly half of employees want more formal AI training",
      ],
    },
    {
      id: "employee_ic",
      version: 2,
      name: "Priya",
      role: "Marketing specialist, individual contributor",
      profile:
        "Frontline knowledge worker with a five-minute attention budget (NNG: 57% of viewing time above the fold). McKinsey: she wants formal AI training but often gets none. WEF: 41% of employers expect to cut headcount as AI automates tasks — so 'upskilling' feels like job security, not a perk. Only engages with learning wired into her actual tools and workflow.",
      goals: [
        "Use AI in daily marketing work without a 45-minute course",
        "Understand whether upskilling protects her role or prepares her replacement",
        "Learn through her existing tools, not a separate corporate portal",
      ],
      objections: [
        {
          id: "time_cost",
          text: "I don't have 45 minutes for a course. I barely have five.",
          critical: true,
          groundedIn:
            "[McKinsey25] More than a fifth of employees report minimal to no employer AI training support; [NNG] attention concentrates above the fold.",
        },
        {
          id: "automation_anxiety",
          text: "Is this training me, or training my replacement?",
          critical: true,
          groundedIn:
            "[WEF25] 41% of employers expect to reduce headcount as AI automates tasks; [OECD25] workers need literacy on risks and responsible use, not just tool access.",
        },
        {
          id: "relevance_to_role",
          text: "Generic AI courses have nothing to do with how I actually work.",
          critical: true,
          groundedIn:
            "[OECD25] Most workers need general AI literacy tied to their role, not generic tool training; [McKinsey25] upskilling must be role-specific to stick.",
        },
      ],
      patienceSeconds: { mean: 32, stdDev: 10 },
      skepticism: 0.72,
      skimPropensity: 0.68,
      ctaPropensity: 0.4,
      trafficWeight: 0.18,
      groundedIn: [
        "[McKinsey25] Employees want training but often don't receive it",
        "[Gallup25] Daily AI use still limited to ~10% of the workforce",
        "[NNG] ~57% of viewing time above the fold",
      ],
    },
    {
      id: "ops_it_buyer",
      version: 2,
      name: "Tomas",
      role: "Head of IT/Operations, evaluates all new tooling",
      profile:
        "Gatekeeper after two painful LMS rollouts. Fosway: fewer than 4 in 10 practitioners say their learning platform is fit for the modern workforce. He scans for SSO, HRIS/LMS integration, data handling, and who validates AI-generated content. OECD frames AI literacy as evaluating outputs and risks — he needs to know the vendor does too.",
      goals: [
        "Avoid another siloed platform that doesn't integrate with LMS, HRIS, and SSO",
        "Verify AI-generated content quality and security before L&D buys",
        "Keep go-live inside a quarter while budgets stay flat (Fosway)",
      ],
      objections: [
        {
          id: "integration_friction",
          text: "Does this plug into our LMS, HRIS, and SSO — or is it another silo?",
          critical: true,
          groundedIn:
            "[Fosway25] Integration friction and platform sprawl remain top enterprise learning pain points; [TrainingMag25] buyers expect rapid implementation cycles.",
        },
        {
          id: "content_quality",
          text: "AI-generated lessons? Who validates accuracy before my users see them?",
          critical: true,
          groundedIn:
            "[OECD25] AI literacy includes evaluating outputs, risks, and ethics — not just accepting generated content.",
        },
        {
          id: "implementation_burden",
          text: "What's the real go-live time — weeks or quarters?",
          critical: false,
          groundedIn:
            "[Fosway25] Enterprise buyers expect platforms live in weeks, not quarters, amid static L&D budgets.",
        },
      ],
      patienceSeconds: { mean: 50, stdDev: 12 },
      skepticism: 0.78,
      skimPropensity: 0.58,
      ctaPropensity: 0.38,
      trafficWeight: 0.15,
      groundedIn: [
        "[Fosway25] Integration friction + admin burden dominate practitioner complaints",
        "[Fosway25] <40% say their learning platform is fit for the modern workforce",
      ],
    },
    {
      id: "ld_team_lead",
      version: 2,
      name: "Sofia",
      role: "L&D Team Lead, 4-person team, no AI specialists",
      profile:
        "Four-person L&D team, no AI engineers. OECD: training supply for general AI literacy lags demand; WEF: reskilling capacity is the binding constraint. LinkedIn: she's expected to be a 'career champion' while Fosway shows reporting overhead already eats her week. Needs something her team can run without hiring specialists.",
      goals: [
        "Launch AI-driven learning without hiring AI engineers",
        "Cut admin and reporting time instead of adding another dashboard",
        "Separate real AI capability from vendor rebranding (McKinsey: 1% at AI maturity)",
      ],
      objections: [
        {
          id: "implementation_burden",
          text: "We can't implement AI-driven learning — we don't have the people or the time.",
          critical: true,
          groundedIn:
            "[OECD25] Training supply insufficient for general AI literacy; [WEF25] reskilling capacity is the binding constraint for most employers.",
        },
        {
          id: "roi_proof",
          text: "Reporting on our current platform already eats my week. Will this make that worse?",
          critical: true,
          groundedIn:
            "[Fosway25] Reporting and admin overhead among top reasons platforms fail practitioner fit tests.",
        },
        {
          id: "credibility",
          text: "Every vendor slapped 'AI' on their homepage. Why should I trust this one?",
          critical: false,
          groundedIn:
            "[McKinsey25] Only 1% of companies believe they have reached AI maturity despite near-universal investment.",
        },
      ],
      patienceSeconds: { mean: 65, stdDev: 16 },
      skepticism: 0.58,
      skimPropensity: 0.38,
      ctaPropensity: 0.58,
      trafficWeight: 0.15,
      groundedIn: [
        "[LinkedIn25] L&D expected to prove impact as 'career champions' with limited headcount",
        "[OECD25] General AI literacy programmes lag specialist training supply",
      ],
    },
    {
      id: "compliance_lead",
      version: 2,
      name: "Anneke",
      role: "Head of People, EU-headquartered fintech",
      profile:
        "EU AI Act Article 4 created a dated, non-optional obligation: demonstrable AI literacy across 1,200 employees, enforceable from February 2025. She needs per-employee audit trails, not completion certificates. Fosway: compliance dashboards exist but audit-grade analytics remain a gap. Comparing three vendors this week.",
      goals: [
        "Map rollout to EU AI Act Article 4 with auditable per-employee evidence",
        "Deploy AI literacy to 1,200 employees this quarter",
        "Avoid a platform that only produces completion certificates",
      ],
      objections: [
        {
          id: "compliance_coverage",
          text: "Does this actually map to Article 4 — or is 'compliance' a marketing word?",
          critical: true,
          groundedIn:
            "[EUAIAct] Article 4 AI-literacy obligation applies to providers and deployers from Feb 2025.",
        },
        {
          id: "roi_proof",
          text: "I need audit-ready reporting per employee, not a completion certificate.",
          critical: true,
          groundedIn:
            "[Fosway25] Compliance reporting exists but audit-grade analytics remain a common platform gap.",
        },
        {
          id: "implementation_burden",
          text: "This quarter. Can it be live this quarter?",
          critical: false,
          groundedIn:
            "[OECD25] Employers need to scale AI literacy supply quickly as adoption accelerates across the EU.",
        },
      ],
      patienceSeconds: { mean: 45, stdDev: 10 },
      skepticism: 0.48,
      skimPropensity: 0.48,
      ctaPropensity: 0.72,
      trafficWeight: 0.1,
      groundedIn: [
        "[EUAIAct] Article 4 creates dated, non-optional demand for deployers",
        "[OECD25] Policy push to expand accessible AI literacy programmes",
      ],
    },
  ],
};
