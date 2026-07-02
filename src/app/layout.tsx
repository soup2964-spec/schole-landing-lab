import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { JellyShell } from "@/components/JellyShell";

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
    "LLM persona agents simulate user behavior, a bandit compares landing page variants, and optimizer agents breed improved pages with evidence-backed changelogs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white font-sans text-slate-900">
        <AnalyticsProvider>
          <JellyShell>{children}</JellyShell>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
