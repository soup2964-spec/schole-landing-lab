import { DashboardShell } from "@/components/Nav";
import { ChallengeDashboard } from "@/components/challenge/ChallengeDashboard";

export default function Home() {
  return (
    <DashboardShell>
      <ChallengeDashboard />
    </DashboardShell>
  );
}
