import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "../styles/globals.css";
import { AnalyticsProvider } from "@/ui/shell/AnalyticsProvider";
import { OlebotShell } from "@/ui/shell/OlebotShell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Landing Lab · Autonomous landing page evolution for Scholé AI",
  description:
    "Heuristic buyer personas simulate user behavior, a bandit compares landing page variants, and an LLM optimizer breeds improved pages with evidence-backed changelogs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex h-full min-h-0 flex-col overflow-hidden bg-white font-sans text-slate-900">
        <AnalyticsProvider>
          <OlebotShell>{children}</OlebotShell>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
