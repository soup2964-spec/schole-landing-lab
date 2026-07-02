import { NextResponse } from "next/server";
import { loadRun, visitIndex } from "@/lib/registry";
import { loadLoopState } from "@/lib/loop/state";

export async function GET() {
  const run = loadRun();
  if (!run) {
    return NextResponse.json({ error: "No experiment run" }, { status: 404 });
  }

  const lastGen = run.generations[run.generations.length - 1];
  const state = loadLoopState();

  return NextResponse.json({
    runVersion: state.runVersion,
    runId: run.id,
    updatedAt: run.createdAt,
    personaSetVersion: run.personaSetVersion,
    variantCount: run.variants.length,
    generationCount: run.generations.length,
    totalVisits: run.generations.reduce(
      (s, g) => s + (g.totalVisits ?? g.visits.length),
      0
    ),
    index: visitIndex(run),
    variants: run.variants,
    generations: run.generations.map((g) => ({
      generation: g.generation,
      variantIds: g.variantIds,
      totalVisits: g.totalVisits,
      metrics: g.metrics,
      decisions: g.decisions,
      allocationHistory: g.allocationHistory,
      report: { insights: g.report.insights },
    })),
    lastGenBest: lastGen.metrics[0]
      ? {
          variantId: lastGen.metrics[0].variantId,
          conversionRate: lastGen.metrics[0].conversionRate,
          fitness: lastGen.metrics[0].fitness,
        }
      : null,
  });
}
