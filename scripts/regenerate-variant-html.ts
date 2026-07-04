/**
 * Regenerate static HTML for all variants and optionally promote the best candidate.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { loadRun } from "../src/lib/registry";
import { promoteAndDeploy } from "../src/lib/deploy/promote";

const forceBest = process.argv.includes("--promote");

async function main() {
  const run = await loadRun();
  if (!run) {
    console.error("No active run — run an experiment first.");
    process.exit(1);
  }

  const result = await promoteAndDeploy(run, { forceBest: forceBest || true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
