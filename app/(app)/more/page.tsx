import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MorePageClient } from "./MorePageClient";
import type { ProfileColor } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "More" };

export default async function MorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("household_members")
    .select("id, household_id, role, display_name")
    .eq("user_id", user.id)
    .single();

  if (!member) redirect("/onboarding/profile");

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, name, color, care_stage, dob")
    .eq("household_id", member.household_id)
    .is("archived_at", null)
    .order("created_at");

  const { data: memberRows } = await supabase
    .from("household_members")
    .select("id, user_id, role, display_name, initials")
    .eq("household_id", member.household_id)
    .order("created_at");

  const { data: accessRows } = await supabase
    .from("member_profile_access")
    .select("member_id, profile_id")
    .in("member_id", (memberRows ?? []).map((m) => m.id));

  const cookieStore = await cookies();
  const theme = cookieStore.get("bl-theme")?.value ?? "light";

  return (
    <MorePageClient
      currentMemberId={member.id}
      currentRole={member.role as "admin" | "caregiver" | "viewer"}
      profiles={(profileRows ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color as ProfileColor,
        careStage: p.care_stage as "baby" | "child" | "teen_adult",
        dob: p.dob,
      }))}
      members={(memberRows ?? []).map((m) => ({
        id: m.id,
        userId: m.user_id,
        displayName: m.display_name,
        initials: m.initials,
        role: m.role as "admin" | "caregiver" | "viewer",
        restrictedProfileIds: (accessRows ?? [])
          .filter((a) => a.member_id === m.id)
          .map((a) => a.profile_id),
      }))}
      currentTheme={theme}
    />
  );
}
