import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = { title: "Log" };

export default function HomePage() {
  return (
    <>
      <AppHeader title="Log" profileName="Leo" />
      <div className="px-4 py-6">
        <p className="text-muted-foreground text-body">
          Quick Log tiles — coming in M4.
        </p>
      </div>
    </>
  );
}
