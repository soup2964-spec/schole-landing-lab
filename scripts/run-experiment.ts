/**
 * Runs the multi-generation experiment and writes data/run.json.
 * Usage: npm run experiment  (requires OPENAI_API_KEY or KIE_API_KEY for breeding)
 */
import fs from "fs";
import path from "path";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const { runExperiment, DEFAULT_CONFIG } = await import("../src/lab/evolution/run");

  const run = await runExperiment({
    ...DEFAULT_CONFIG,
    log: (msg: string) => console.log(msg),
  });

  const outPath = path.join(process.cwd(), "data", "run.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(run, null, 1));

  console.log(`\nWrote ${outPath}`);
  for (const gen of run.generations) {
    console.log(`\nGeneration ${gen.generation}:`);
    for (const m of gen.metrics) {
      console.log(
        `  ${m.variantId.padEnd(16)} fitness=${m.fitness.toFixed(1).padStart(5)} conv=${(m.conversionRate * 100).toFixed(1)}% visits=${m.visits}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
