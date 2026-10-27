import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModulesForm } from "./ModulesForm";

export const metadata: Metadata = { title: "Set up · Step 2" };

const MODULES_BY_STAGE = {
  baby:       ["bathroom", "eating", "mood", "medication"],
  child:      ["bathroom", "eating", "activity", "mood", "medication"],
  teen_adult: ["bathroom", "eating", "activity", "mood", "medication"],
};

export default async function OnboardingModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string }>;
}) {
  const params = await searchParams;
  if (!params.profileId) redirect("/onboarding/profile");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, care_stage, enabled_modules")
    .eq("id", params.profileId)
    .single();

  if (!profile) redirect("/onboarding/profile");

  const defaultModules =
    MODULES_BY_STAGE[profile.care_stage as keyof typeof MODULES_BY_STAGE] ??
    MODULES_BY_STAGE.child;

  return (
    <ModulesForm
      profileId={profile.id}
      careStage={profile.care_stage as "baby" | "child" | "teen_adult"}
      initialModules={(profile.enabled_modules as string[]) ?? defaultModules}
      step={2}
      totalSteps={3}
    />
  );
}
