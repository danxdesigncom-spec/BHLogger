import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/app/(app)/onboarding/profile/ProfileForm";

export const metadata: Metadata = { title: "Add a person" };

export default async function NewProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .single();

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
