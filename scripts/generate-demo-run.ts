/**
 * CLI entry — writes data/run.json using the shared demo experiment engine.
 */
import fs from "fs";
import path from "path";
import { runDemoExperiment } from "../src/lib/evolve/demo-run";

const SEED = 20260701;

function main() {
  console.log("Running demo experiment...");
  const run = runDemoExperiment({ seed: SEED });
  const outPath = path.join(process.cwd(), "data", "run.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(run));
  console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`);

  for (const g of run.generations) {
    console.log(`\nGen ${g.generation}:`);
    for (const m of g.metrics.slice(0, 4)) {
      console.log(
        `  ${m.variantId.padEnd(18)} fitness=${m.fitness.toFixed(1)} conv=${(m.conversionRate * 100).toFixed(1)}%`
      );
    }
  }
}

main();
