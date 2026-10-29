"use server";

import { createInvite } from "@/lib/actions/invites";
import type { Role } from "@/lib/supabase/types";
import { t } from "@/lib/i18n";

type State = null | { success: true; inviteUrl: string; email: string; emailed: boolean } | { error: string };

export async function sendInvite(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const email = formData.get("email") as string;
  const householdId = formData.get("householdId") as string;
  const role = formData.get("role") as Role;
  const profileIdsJson = formData.get("profileIds") as string;

  if (!email?.trim()) {
    return { error: t("errors.caregiverEmail") };
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

  return { success: true, inviteUrl: result.inviteUrl, email: email.trim(), emailed: result.emailed };
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
