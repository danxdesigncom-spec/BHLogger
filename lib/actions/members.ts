"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/supabase/types";

export async function updateMember(
  memberId: string,
  householdId: string,
  role: Role,
  profileIds: string[],
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  // Last-admin guard: reject if this would leave no admin
  if (role !== "admin") {
    const { data: admins, error: adminError } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", householdId)
      .eq("role", "admin");

    if (adminError) return { error: adminError.message };

    const isOnlyAdmin =
      admins?.length === 1 && admins[0].id === memberId;

    if (isOnlyAdmin) {
      return { error: "last_admin" };
    }
  }

  const { error: roleError } = await supabase
    .from("household_members")
    .update({ role })
    .eq("id", memberId);

  if (roleError) return { error: roleError.message };

  // Reconcile member_profile_access:
  // delete all existing rows for this member, then insert new ones
  const { error: deleteError } = await supabase
    .from("member_profile_access")
    .delete()
    .eq("member_id", memberId);

  if (deleteError) return { error: deleteError.message };

  if (profileIds.length > 0) {
    const { error: insertError } = await supabase
      .from("member_profile_access")
      .insert(profileIds.map((pid) => ({ member_id: memberId, profile_id: pid })));

    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/more");
  return { success: true };
}

export async function removeMember(
  memberId: string,
  householdId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  // Last-admin guard
  const { data: admins, error: adminError } = await supabase
    .from("household_members")
    .select("id, role")
    .eq("household_id", householdId)
    .eq("role", "admin");

  if (adminError) return { error: adminError.message };

  const isOnlyAdmin =
    admins?.length === 1 && admins[0].id === memberId;

  if (isOnlyAdmin) {
    return { error: "last_admin" };
  }

  const { error } = await supabase
    .from("household_members")
    .delete()
    .eq("id", memberId);

  if (error) return { error: error.message };

  revalidatePath("/more");
  return { success: true };
}
