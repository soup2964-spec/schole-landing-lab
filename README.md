# Olébot / Scholé Landing Lab

Autonomous landing page evolution for [Scholé AI](https://schole.ai/).

LLM-powered optimizer breeds landing page variants. Heuristic buyer personas simulate user behavior; a Thompson-sampling bandit allocates traffic and evidence-backed changelogs explain each generation.

**Live repo:** https://github.com/soup2964-spec/OLebot

## Live edits (start here)

Under time pressure, edit **`src/config/`** first:

| Want to change… | File |
|-----------------|------|
| Variant copy / CTAs | `src/config/variants.ts` → then `npm run prepare:variants` |
| Personas / objections | `src/config/personas.ts` |
| Promote / kill thresholds | `src/config/thresholds.ts` |
| Workbench section labels | `src/config/criteria.ts` |

**Do not** hand-edit `public/baseline/variants/*.html`.

## Codebase map

```
src/
  config/       # EDIT HERE — copy, personas, criteria, thresholds
  ui/           # React by surface (workbench / live / landing / shell)
  lab/          # Product brain (simulation → evolution → live-loop → …)
  shared/       # Infra (schema, db, llm, fs, stats, registry)
  app/          # Thin Next.js routes + API (grouped; URLs unchanged)
  styles/       # globals.css
```

Dependency rule: `app → ui → lab → shared` (and `lab` reads `config`).

`public/`, `data/`, `scripts/`, and `supabase/` stay at the repo root (deploy / FS contracts).

## What you'll see

| Surface | What it covers |
|---------|----------------|
| **Control** (`/`) | Run experiments, autonomous mode |
| **Versions** | Gen-0 + bred page comparison |
| **Method / Personas / Behavior / Winners** | Side-menu detail panels on `/` |
| **Live** (`/live`) | Live loop + calibration |
| **Variants** (`/v/[id]`) | Live landing replicas |

Legacy paths (`/variants`, `/experiment`, `/personas`, `/behavior`, `/results`, `/evolution`) redirect to `/`.

## Quick start

```bash
npm install
cp .env.example .env.local   # set KIE_API_KEY or OPENAI_API_KEY for experiments
npm run dev                  # open http://localhost:3000
```

Run an experiment from the **Control** tab (~2–5 min: heuristic personas + LLM breeding).

### CLI experiment

```bash
npm run experiment  # multi-generation run, writes data/run.json
```

## Architecture

```
Generation 0 variants (JSON in src/config/variants.ts)
        ↓
Persona agents (heuristic readings, objection-gated conversion)
        ↓
Monte Carlo visits + Thompson bandit
        ↓
Evaluator agent (rubric scorecards)
        ↓
Optimizer agent (mutation + crossover + changelog)
        ↓
Generation N+1 … → HTML replicas under public/baseline/
```

- **Pages are structured JSON**, rendered via the replica HTML pipeline and React fallbacks.
- **Personas carry objection ledgers** grounded in published buyer research.
- **PostHog + GTM + Clarity** tag every variant page for sim-to-real calibration.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js (runs `prepare:pages` first) |
| `npm run experiment` | Multi-generation run (CLI) |
| `npm run reset:lab` | Wipe experiment history and bred pages |
| `npm run prepare:variants` | Rebuild Gen-0 HTML after copy edits |
| `npm run build` | Production build |

## Deploy

Deploy to Vercel. Set `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_GTM_ID`, and server-side `POSTHOG_API_KEY` + `POSTHOG_PROJECT_ID` to instrument live traffic and calibrate simulations.

### Live learning loop

Every variant page sends a session heartbeat + PostHog/GTM events. When **5+ new visitors** arrive (configurable via `LOOP_MIN_NEW_VISITORS`):

1. Pull live metrics from PostHog
2. Recalibrate persona parameters
3. Re-run the simulation
4. Dashboard auto-refreshes

Vercel Cron hits `/api/cron/sync-loop` daily (`0 12 * * *` in `vercel.json`) as a backup trigger. Set `CRON_SECRET` in Vercel env vars.

Built for the Scholé AI GTM challenge.
