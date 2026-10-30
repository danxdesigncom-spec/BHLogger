"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_HOUSEHOLD_COOKIE } from "@/lib/households/active";
import type { Role } from "@/lib/supabase/types";
import { t } from "@/lib/i18n";

export interface CreateInviteInput {
  householdId: string;
  email: string;
  role: Role;
  profileIds: string[];
}

export async function createInvite(
  input: CreateInviteInput,
): Promise<{ token: string; inviteUrl: string; emailed: boolean } | { error: string }> {
  const supabase = await createClient();

  // Fetch the caller's member row id (needed for created_by)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("errors.notAuthenticated") };

  const { data: member, error: memberError } = await supabase
    .from("household_members")
    .select("id")
    .eq("household_id", input.householdId)
    .eq("user_id", user.id)
    .single();

  if (memberError || !member) return { error: t("errors.memberNotFound") };

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

  // ACC-07 (M3 decision A1a): Supabase's own email takes the invite link to them. Copy link always works too.
  const emailed = input.email.trim() ? await emailInvite(input.email.trim(), inviteUrl) : false;

  revalidatePath("/more");
  return { token: data.token, inviteUrl, emailed };
}

/**
 * Sends the invite link with Supabase Auth's email: its "Invite user" email to a new address, or its
 * sign-in email to someone who already has an account. Both links open the join page (S24), where the
 * existing accept flow takes over. The links work on any device because nothing is tied to the
 * admin's browser. Delivery depends on the project's SMTP settings; false means it wasn't sent.
 */
async function emailInvite(email: string, inviteUrl: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) return false;
  const stateless = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

  if (serviceKey) {
    const service = createSupabaseClient(url, serviceKey, stateless);
    const { error } = await service.auth.admin.inviteUserByEmail(email, { redirectTo: inviteUrl });
    if (!error) return true;
    if (error.code !== "email_exists" && !/already/i.test(error.message)) return false;
  }
  // An existing account (or no service key): a sign-in link that lands on the invite.
  const mailer = createSupabaseClient(url, anonKey, { auth: { ...stateless.auth, flowType: "implicit" as const } });
  const { error } = await mailer.auth.signInWithOtp({ email, options: { emailRedirectTo: inviteUrl, shouldCreateUser: true } });
  return !error;
}

export async function acceptInvite(
  token: string,
  displayName: string,
  initials: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const householdsOf = async () =>
    user ? ((await supabase.from("household_members").select("household_id").eq("user_id", user.id)).data ?? []).map((m) => m.household_id) : [];
  const before = await householdsOf();

  const { error } = await supabase.rpc("accept_invite", {
    p_token: token,
    p_display_name: displayName,
    p_initials: initials,
  });

  if (error) return { error: error.message };

  // ACC-07: an accepted invite opens that household, even for someone who already belongs to another.
  const joined = (await householdsOf()).find((id) => !before.includes(id));
  if (joined) (await cookies()).set(ACTIVE_HOUSEHOLD_COOKIE, joined, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });

  revalidatePath("/", "layout");
  return { success: true };
}
