import { SimulationDashboardShell } from "@/components/Nav";
import { ChallengeDashboard } from "@/components/challenge/ChallengeDashboard";

export default function Home() {
  return (
    <SimulationDashboardShell>
      <ChallengeDashboard />
    </SimulationDashboardShell>
  );
}
