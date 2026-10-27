import type { Metadata } from "next";

export const metadata: Metadata = { title: "Set up" };

// Onboarding uses its own layout: no tab bar, centered content
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh flex flex-col bg-surface">
      {children}
    </main>
  );
}
