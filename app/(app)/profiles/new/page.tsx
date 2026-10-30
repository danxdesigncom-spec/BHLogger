import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/households/server";
import { ProfileForm } from "@/app/(app)/onboarding/profile/ProfileForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("metaAddPerson") };
}

export default async function NewProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { member } = await getActiveMembership(supabase, user.id);

  if (!member || member.role !== "admin") redirect("/more");

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <ProfileForm
        householdId={member.household_id}
        initialDisplayName=""
        step={1}
        totalSteps={1}
      />
    </div>
  );
}
