"use server";

import { redirect } from "next/navigation";
import { updateMember, removeMember } from "@/lib/actions/members";
import type { Role } from "@/lib/supabase/types";

type SaveState = null | { error: string } | { success: true };

export async function saveMember(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const memberId = formData.get("memberId") as string;
  const householdId = formData.get("householdId") as string;
  const role = formData.get("role") as Role;
  const profileIdsJson = formData.get("profileIds") as string;

  let profileIds: string[] = [];
  try {
    profileIds = JSON.parse(profileIdsJson) as string[];
  } catch {
    profileIds = [];
  }

  const result = await updateMember(memberId, householdId, role, profileIds);
  if ("error" in result) return { error: result.error };

  redirect("/more");
}

type RemoveState = null | { error: string };

export async function removeMemberAction(
  _prev: RemoveState,
  formData: FormData,
): Promise<RemoveState> {
  const memberId = formData.get("memberId") as string;
  const householdId = formData.get("householdId") as string;

  const result = await removeMember(memberId, householdId);
  if ("error" in result) return { error: result.error };

  redirect("/more");
}
