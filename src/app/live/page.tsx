import Link from "next/link";
import { LiveDashboard } from "@/components/live/LiveDashboard";

export default function LivePage() {
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-5xl">
        <Link href="/" className="mb-4 inline-block text-sm font-medium text-schole-primary hover:underline">
          ← Back to experiment workbench
        </Link>
        <LiveDashboard />
      </div>
    </div>
  );
}
