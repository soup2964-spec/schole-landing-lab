# Scholé Landing Lab

Autonomous landing page evolution for [Scholé AI](https://schole.ai/).

LLM-powered persona agents simulate user behavior on landing page variants. A Thompson-sampling bandit allocates traffic, an evaluator agent scores results, and an optimizer agent breeds improved pages — generation after generation — with evidence-backed changelogs.

**Live repo:** https://github.com/soup2964-spec/schole-landing-lab

## What you'll see

| Tab | Requirement covered |
|-----|---------------------|
| **Variants** | The initial landing page versions (6 Generation-0 strategic bets + bred offspring) |
| **Method** | How the pages are compared (personas, objection ledger, bandit, rubric) |
| **Behavior** | Simulated user behavior (heatmaps + replay theater) |
| **Results** | Which versions performed better (leaderboard, allocation, scorecards) |
| **Evolution** | New generated variations + what changed and why (changelogs) |

## Quick start

```bash
npm install
cp .env.example .env.local   # set KIE_API_KEY or OPENAI_API_KEY for experiments
npm run dev                  # open http://localhost:3000
```

Run an experiment from the **Control** tab in the dashboard (hybrid ~2–5 min, full LLM ~20 min).

### Full LLM experiment (optional)

```bash
cp .env.example .env.local
# set OPENAI_API_KEY and optionally NEXT_PUBLIC_CLARITY_ID
npm run experiment  # ~30-60 min, writes data/run.json with LLM readings
```

## Architecture

```
Generation 0 variants (JSON schema)
        ↓
Persona agents (objection-gated conversion)
        ↓
Monte Carlo visits + Thompson bandit
        ↓
Evaluator agent (rubric scorecards)
        ↓
Optimizer agent (mutation + crossover + changelog)
        ↓
Generation N+1 …
```

- **Pages are structured JSON**, rendered by a fixed component library — agents read them cheaply, the optimizer can only emit valid pages, and diffs are precise.
- **Personas carry objection ledgers** grounded in published 2025–26 buyer research (TalentLMS, G2, Rise Up, eLearning Industry, Docebo).
- **PostHog + Google Tag Manager + Clarity** tag every variant page (`variant_id`, `cta_click`, `scroll_depth`) for sim-to-real calibration. Live traffic adjusts persona parameters via `POST /api/calibration`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run experiment` | Full LLM-powered multi-generation run (CLI) |
| `npm run reset:lab` | Wipe experiment history and bred pages |
| `npm run build` | Production build |

## Deploy

Deploy to Vercel. Set `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_GTM_ID`, and server-side `POSTHOG_API_KEY` + `POSTHOG_PROJECT_ID` to instrument live traffic and calibrate simulations.

### Live learning loop

Every variant page sends a session heartbeat + PostHog/GTM events. When **5+ new visitors** arrive (configurable via `LOOP_MIN_NEW_VISITORS`):

1. Pull live metrics from PostHog
2. Recalibrate persona parameters (`data/calibration.json`)
3. Re-run the simulation (`data/run.json`)
4. Dashboard auto-refreshes (polls every 30s)

Vercel Cron hits `/api/cron/sync-loop` every 5 minutes as a backup trigger. Set `CRON_SECRET` in Vercel env vars.

Built for the Scholé AI GTM challenge.
