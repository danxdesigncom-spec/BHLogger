"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/app/auth/demo/actions";
import { validateEntryData } from "@/lib/schemas/entry";
import { FAVORITE_TYPES, MAX_FAVORITES } from "@/lib/favorites";
import type { Json } from "@/lib/supabase/types";
import { t } from "@/lib/i18n";

type Result = { success: true } | { error: string };

const AddSchema = z.object({
  profileId: z.string().uuid(),
  label: z.string().trim().min(1).max(40),
  template: z.object({ type: z.enum(FAVORITE_TYPES), data: z.record(z.unknown()) }),
});

/** QL-09: RLS limits writes to admins and caregivers in the profile's household. */
export async function addFavorite(input: { profileId: string; label: string; template: { type: string; data: Record<string, unknown> } }): Promise<Result> {
  const parsed = AddSchema.safeParse(input);
  if (!parsed.success) return { error: t("errors.invalidFavorite") };
  const valid = validateEntryData(parsed.data.template.type, parsed.data.template.data);
  if (!valid.success) return { error: t("errors.invalidFavorite") };
  if (await isDemoMode()) return { success: true };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", parsed.data.profileId).maybeSingle();
  if (!profile) return { error: t("errors.profileNotFound") };
  const { count } = await supabase.from("favorites").select("id", { count: "exact", head: true }).eq("profile_id", parsed.data.profileId);
  if ((count ?? 0) >= MAX_FAVORITES) return { error: t("errors.tooManyFavorites", { max: MAX_FAVORITES }) };
  const { error } = await supabase.from("favorites").insert({
    household_id: profile.household_id,
    profile_id: parsed.data.profileId,
    label: parsed.data.label,
    entry_template: { type: parsed.data.template.type, data: valid.data } as Json,
    sort_order: count ?? 0,
  });
  return error ? { error: error.message } : { success: true };
}

export async function removeFavorite(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { error: t("errors.invalidFavorite") };
  if (await isDemoMode()) return { success: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from("favorites").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { error: error.message };
  return data ? { success: true } : { error: t("errors.invalidFavorite") };
}

export async function reorderFavorites(profileId: string, ids: string[]): Promise<Result> {
  const parsed = z.object({ profileId: z.string().uuid(), ids: z.array(z.string().uuid()).max(MAX_FAVORITES) }).safeParse({ profileId, ids });
  if (!parsed.success) return { error: t("errors.invalidFavorite") };
  if (await isDemoMode()) return { success: true };
  const supabase = await createClient();
  for (const [i, id] of parsed.data.ids.entries()) {
    const { error } = await supabase.from("favorites").update({ sort_order: i }).eq("id", id).eq("profile_id", parsed.data.profileId);
    if (error) return { error: error.message };
  }
  return { success: true };
}
