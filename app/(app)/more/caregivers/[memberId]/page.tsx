import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/households/server";
import { ManageCaregiverClient } from "./ManageCaregiverClient";
import type { ProfileColor } from "@/lib/supabase/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("caregivers");
  return { title: t("manageTitle") };
}

export default async function ManageCaregiverPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { member: viewer } = await getActiveMembership(supabase, user.id);

  if (!viewer || viewer.role !== "admin") redirect("/more");

  const { data: target } = await supabase
    .from("household_members")
    .select("id, household_id, role, display_name, initials, created_at")
    .eq("id", memberId)
    .eq("household_id", viewer.household_id)
    .single();

  if (!target) redirect("/more");

  // Last logged: latest entry by this user in this household
  const { data: lastEntry } = await supabase
    .from("entries")
    .select("occurred_at")
    .eq("household_id", viewer.household_id)
    .eq("logged_by", target.id) // stored as member id in logged_by
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, name, color")
    .eq("household_id", viewer.household_id)
    .is("archived_at", null)
    .order("created_at");

  const { data: accessRows } = await supabase
    .from("member_profile_access")
    .select("profile_id")
    .eq("member_id", memberId);

  const restrictedIds = (accessRows ?? []).map((a) => a.profile_id);

  return (
    <ManageCaregiverClient
      householdId={viewer.household_id}
      member={{
        id: target.id,
        displayName: target.display_name,
        initials: target.initials,
        role: target.role as "admin" | "caregiver" | "viewer",
        joinedAt: target.created_at,
        lastLoggedAt: lastEntry?.occurred_at ?? null,
        restrictedProfileIds: restrictedIds,
      }}
      profiles={(profileRows ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color as ProfileColor,
      }))}
    />
  );
}
