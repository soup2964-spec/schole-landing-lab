/**
 * CLI entry — manual experiment (heuristic persona readings + LLM breeding).
 * Usage: npx tsx scripts/run-manual-experiment.ts
 */
import { config } from "dotenv";
import path from "path";

config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const { runManualExperiment } = await import("../src/lab/live-loop/manual-experiment");

  console.log("Starting hybrid experiment (heuristic readings + LLM breed)...\n");

  const result = await runManualExperiment();
  console.log("\nDone:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
