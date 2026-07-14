# Live-edit cheat sheet

**Start here under time pressure.** Change content/knobs in this folder — do not hand-edit generated HTML or giant state JSON blobs.

| Want to change… | Edit | Then |
|-----------------|------|------|
| Variant headlines, CTAs, section copy (Gen-0) | [`variants.ts`](./variants.ts) | `npm run prepare:variants` (or restart `dev`) |
| Persona objections / traffic weights | [`personas.ts`](./personas.ts) | Re-run experiment |
| Persona research citations | [`persona-research.ts`](./persona-research.ts) | Refresh dashboard |
| Workbench section labels / criteria copy | [`criteria.ts`](./criteria.ts) | Refresh |
| Promote / kill / bounce thresholds | [`thresholds.ts`](./thresholds.ts) | Re-run experiment |
| Dashboard brand colors | [`../styles/globals.css`](../styles/globals.css) | Refresh |
| Run / stop experiment | Control Center UI on `/` | — |
| Wipe lab mid-demo | `npm run reset:lab` | — |

## Do not hand-edit

- `public/baseline/variants/*.html` — regenerated from `variants.ts` + replica pipeline
- `public/baseline/schole-original.html` / prepared `index.html` — Framer source; use prepare scripts
- `data/deploy-state.json` copy blobs — prefer Control Center / promote API
- HTML swap anchors in `src/domains/replica/baseline-copy.ts` unless baseline Framer text changed

## Where logic lives (if you must go deeper)

| Area | Folder |
|------|--------|
| Simulation dashboard UI | `src/features/workbench/` |
| Live analytics UI | `src/features/live/` |
| Variant landing pages | `src/features/landing/` |
| Experiment / bandit / optimizer | `src/domains/evolve/`, `src/domains/sim/` |
| HTML replica apply | `src/domains/replica/` |
| Live loop / progress | `src/domains/loop/` |
| Persistence / registry | `src/platform/` |
