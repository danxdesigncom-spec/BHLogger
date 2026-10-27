import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Create a profile" };

export default async function OnboardingProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ householdName?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // If the user already has a household, skip onboarding
  const { data: existing } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const cookieStore = await cookies();
  const displayName =
    cookieStore.get("bl-onboarding-display-name")?.value ??
    user.email?.split("@")[0] ??
    "";

  return (
    <ProfileForm
      householdId={existing?.household_id ?? null}
      initialDisplayName={displayName}
      householdName={params.householdName}
      step={1}
      totalSteps={3}
    />
  );
}
