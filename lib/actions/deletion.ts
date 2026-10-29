"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/app/auth/demo/actions";
import { DEMO_COOKIE } from "@/lib/demo";
import { DEMO_OVERRIDES_COOKIE, readDemoOverrides } from "@/lib/demo/overrides";
import { demoHousehold } from "@/lib/demo/household";
import type { Database } from "@/lib/supabase/types";
import { t } from "@/lib/i18n";

type Result = { success: true } | { error: string };

/**
 * SET-07: delete a profile and everything logged for it, for every caregiver. Admins only; the
 * delete_profile() function checks the role in the database and records an audit event.
 * The household's last profile goes with the account instead, so Home always has someone to log for.
 */
export async function deleteProfile(profileId: string): Promise<Result> {
  if (!z.string().uuid().safeParse(profileId).success) return { error: t("errors.invalidProfileChange") };

  if (await isDemoMode()) {
    const overrides = await readDemoOverrides();
    const demo = demoHousehold(overrides);
    if (demo.profiles.length + demo.archivedProfiles.length <= 1) return { error: t("errors.lastProfile") };
    const next = { ...overrides, profiles: { ...overrides.profiles, [profileId]: { ...overrides.profiles?.[profileId], deleted: true } } };
    (await cookies()).set(DEMO_OVERRIDES_COOKIE, JSON.stringify(next), { path: "/", sameSite: "lax", httpOnly: true });
    revalidatePath("/", "layout");
    return { success: true };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", profileId).maybeSingle();
  if (!profile) return { error: t("errors.profileGone") };
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("household_id", profile.household_id);
  if ((count ?? 0) <= 1) return { error: t("errors.lastProfile") };

  const { error } = await supabase.rpc("delete_profile", { p_profile_id: profileId });
  if (error) return { error: error.message.includes("admin_only") ? t("errors.adminProfile") : t("errors.profileNotDeleted") };
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * SET-07: delete the signed-in account. delete_my_account() handles the household in one transaction
 * (the only member takes the household with them; the last admin of a shared household is refused),
 * then the auth user is deleted with the service-role key, which only exists on the server.
 * In demo mode this clears the demo and leaves it. The caller clears this device's local data.
 */
export async function deleteAccount(): Promise<Result> {
  if (await isDemoMode()) {
    const store = await cookies();
    store.delete(DEMO_COOKIE);
    store.delete(DEMO_OVERRIDES_COOKIE);
    return { success: true };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: t("errors.notSignedIn") };

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: error.message.includes("last_admin") ? t("errors.lastAdminAccount") : t("errors.accountNotDeleted") };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { error: t("errors.accountPartlyDeleted") };
  const service = createServiceClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: authError } = await service.auth.admin.deleteUser(user.id);
  // The household side is already done; trying again finishes the account (delete_my_account returns 'no_household').
  if (authError) return { error: t("errors.accountPartlyDeleted") };

  // The session's user no longer exists, so only this browser's cookies need clearing.
  await supabase.auth.signOut({ scope: "local" });
  return { success: true };
}
