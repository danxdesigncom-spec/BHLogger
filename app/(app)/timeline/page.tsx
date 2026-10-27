import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = { title: "Timeline" };

export default function TimelinePage() {
  return (
    <>
      <AppHeader title="Timeline" />
      <div className="px-4 py-6">
        <p className="text-muted-foreground text-body">Timeline — coming in M7.</p>
      </div>
    </>
  );
}
