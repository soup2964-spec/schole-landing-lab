import { allVariants, loadRun, visitIndex } from "@/lib/registry";
import { loadLoopState } from "@/lib/loop/state";
import { ExperimentWorkbench } from "@/components/experiment/ExperimentWorkbench";

export default function Home() {
  const run = loadRun();
  const variants = allVariants();
  const { runVersion } = loadLoopState();
  const index = run ? visitIndex(run) : null;

  return (
    <ExperimentWorkbench
      initialRun={run}
      initialVariants={variants}
      initialRunVersion={runVersion}
      initialIndex={index}
    />
  );
}
