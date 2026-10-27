import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <>
      <AppHeader title="Insights" />
      <div className="px-4 py-6">
        <p className="text-muted-foreground text-body">Today — coming in M9.</p>
      </div>
    </>
  );
}
