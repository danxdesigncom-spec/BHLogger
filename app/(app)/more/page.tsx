import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = { title: "More" };

export default function MorePage() {
  return (
    <>
      <AppHeader title="More" />
      <div className="px-4 py-6">
        <p className="text-muted-foreground text-body">
          Profiles, caregivers and settings — coming in M3 and M11.
        </p>
      </div>
    </>
  );
}
