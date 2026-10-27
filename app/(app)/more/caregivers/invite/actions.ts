"use server";

import { createInvite } from "@/lib/actions/invites";
import type { Role } from "@/lib/supabase/types";

type State = null | { success: true; inviteUrl: string } | { error: string };

export async function sendInvite(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const email = formData.get("email") as string;
  const householdId = formData.get("householdId") as string;
  const role = formData.get("role") as Role;
  const profileIdsJson = formData.get("profileIds") as string;

  if (!email?.trim()) {
    return { error: "Please enter the caregiver's email address." };
  }

  let profileIds: string[] = [];
  try {
    const parsed = JSON.parse(profileIdsJson) as string[];
    profileIds = parsed;
  } catch {
    profileIds = [];
  }

  const result = await createInvite({ householdId, email, role, profileIds });
  if ("error" in result) return { error: result.error };

  return { success: true, inviteUrl: result.inviteUrl };
}

export async function copyInviteLink(
  formData: FormData,
): Promise<{ inviteUrl: string } | { error: string }> {
  const householdId = formData.get("householdId") as string;
  const role = formData.get("role") as Role;
  const profileIdsJson = formData.get("profileIds") as string;

  let profileIds: string[] = [];
  try {
    profileIds = JSON.parse(profileIdsJson) as string[];
  } catch {
    profileIds = [];
  }

  // Use a placeholder email for link-only invites
  const result = await createInvite({
    householdId,
    email: "",
    role,
    profileIds,
  });

  if ("error" in result) return { error: result.error };
  return { inviteUrl: result.inviteUrl };
}
