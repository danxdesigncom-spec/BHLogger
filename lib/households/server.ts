import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Role } from "@/lib/supabase/types";
import { ACTIVE_HOUSEHOLD_COOKIE, pickMembership, type OtherHousehold } from "@/lib/households/active";
import { toProfileSummary } from "@/lib/profiles";

export interface Membership {
  id: string;
  household_id: string;
  role: Role;
  display_name: string;
  initials: string;
  access_from: string | null;
  created_at: string;
}

/** The signed-in person's memberships and the one active on this device (see pickMembership). */
export async function getActiveMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ member: Membership | null; memberships: Membership[] }> {
  const { data } = await supabase
    .from("household_members")
    .select("id, household_id, role, display_name, initials, access_from, created_at")
    .eq("user_id", userId);
  const memberships = (data ?? []) as Membership[];
  const chosen = (await cookies()).get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
  return { member: pickMembership(memberships, chosen), memberships };
}

/** The person's other households: names, the people they can see there, and member and admin counts. */
export async function getOtherHouseholds(supabase: SupabaseClient<Database>, others: Membership[]): Promise<OtherHousehold[]> {
  if (!others.length) return [];
  const ids = others.map((m) => m.household_id);
  const [{ data: households }, { data: profiles }, { data: members }] = await Promise.all([
    supabase.from("households").select("id, name").in("id", ids),
    supabase
      .from("profiles")
      .select("id, household_id, name, color, care_stage, dob, toileting, feeding_methods, enabled_modules, settings, care_card, archived_at")
      .in("household_id", ids)
      .is("archived_at", null)
      .order("created_at"),
    supabase.from("household_members").select("household_id, role").in("household_id", ids),
  ]);
  return [...others]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((m) => ({
      id: m.household_id,
      name: households?.find((h) => h.id === m.household_id)?.name ?? "",
      role: m.role,
      people: (profiles ?? [])
        .filter((p) => p.household_id === m.household_id)
        .map((p) => {
          const s = toProfileSummary(p);
          return { id: s.id, name: s.name, color: s.color, initials: s.initials };
        }),
      memberCount: (members ?? []).filter((x) => x.household_id === m.household_id).length,
      adminCount: (members ?? []).filter((x) => x.household_id === m.household_id && x.role === "admin").length,
    }));
}
