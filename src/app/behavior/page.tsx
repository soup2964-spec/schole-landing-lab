import { PageShell, EmptyRun } from "@/components/Nav";
import { BehaviorDashboardClient } from "@/components/behavior/BehaviorDashboardClient";
import { loadRun, allVariants, visitIndex } from "@/lib/registry";

export default function BehaviorPage() {
  const run = loadRun();
  const variants = allVariants();

  return (
    <PageShell
      active="/behavior"
      wide
      title="Behavior dashboard"
      subtitle="Live-updating view of simulated user behavior. As real visitors hit variant pages, the learning loop recalibrates personas and refreshes predictions automatically."
    >
      {run ? (
        <BehaviorDashboardClient
          initialIndex={visitIndex(run)}
          initialVariants={variants}
        />
      ) : (
        <EmptyRun />
      )}
    </PageShell>
  );
}
