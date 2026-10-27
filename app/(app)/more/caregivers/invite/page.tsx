import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteSheet } from "./InviteSheet";
import type { ProfileColor } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Invite a caregiver" };

export default async function InviteCaregiversPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("household_members")
    .select("id, household_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member || member.role !== "admin") redirect("/more");

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, name, color")
    .eq("household_id", member.household_id)
    .is("archived_at", null)
    .order("created_at");

  return (
    <InviteSheet
      householdId={member.household_id}
      profiles={(profileRows ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color as ProfileColor,
      }))}
    />
  );
}
