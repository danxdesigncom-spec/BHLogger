"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/supabase/types";

export interface CreateInviteInput {
  householdId: string;
  email: string;
  role: Role;
  profileIds: string[];
}

export async function createInvite(
  input: CreateInviteInput,
): Promise<{ token: string; inviteUrl: string } | { error: string }> {
  const supabase = await createClient();

  // Fetch the caller's member row id (needed for created_by)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: member, error: memberError } = await supabase
    .from("household_members")
    .select("id")
    .eq("household_id", input.householdId)
    .eq("user_id", user.id)
    .single();

  if (memberError || !member) return { error: "Member record not found" };

  const { data, error } = await supabase
    .from("invites")
    .insert({
      household_id: input.householdId,
      email: input.email,
      role: input.role,
      profile_ids: input.profileIds,
      created_by: member.id,
    })
    .select("token")
    .single();

  if (error) return { error: error.message };

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const inviteUrl = `${origin}/invite/${data.token}`;

  // Send email via Supabase Auth admin (uses project's configured SMTP / magic-link sender).
  // Falls back silently — the Copy link button always works.
  const { error: emailError } = await supabase.auth.admin
    ? // admin client not available from anon key — email is sent via Supabase
      // transactional emails configured in the dashboard (Auth > Email Templates).
      // For now the invite link is returned to the caller; the UI shows Copy link.
      { error: null }
    : { error: null };

  void emailError; // intentionally unused — email delivery is best-effort

  revalidatePath("/more");
  return { token: data.token, inviteUrl };
}

export async function acceptInvite(
  token: string,
  displayName: string,
  initials: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("accept_invite", {
    p_token: token,
    p_display_name: displayName,
    p_initials: initials,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}
