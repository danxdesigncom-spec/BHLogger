import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <>
      <AppHeader title="Reports" />
      <div className="px-4 py-6">
        <p className="text-muted-foreground text-body">Reports — coming in M10.</p>
      </div>
    </>
  );
}
