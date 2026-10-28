"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { isDemoMode } from "@/app/auth/demo/actions";
import { validateEntryData } from "@/lib/schemas/entry";
import type { Json } from "@/lib/supabase/types";
import { t } from "@/lib/i18n";

type Result = { success: true } | { error: string };

const SaveEntrySchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  profileId: z.string().uuid(),
  type: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  tz: z.string(),
  data: z.record(z.unknown()).default({}),
  note: z.string().max(2000).optional(),
  flaggedForDoctor: z.boolean().default(false),
});

export type SaveEntryInput = z.infer<typeof SaveEntrySchema>;

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function saveEntry(input: SaveEntryInput): Promise<Result> {
  const parsed = SaveEntrySchema.safeParse(input);
  if (!parsed.success) return { error: t("errors.invalidEntry") };
  if (new Date(parsed.data.occurredAt).getTime() > Date.now() + 60_000) return { error: t("errors.futureEntry") };
  const data = validateEntryData(parsed.data.type, parsed.data.data);
  if (!data.success) return { error: data.error };
  if (await isDemoMode()) return { success: true };

  const { supabase, user } = await authed();
  if (!user) return { error: t("errors.notSignedIn") };

  const { data: member } = await supabase
    .from("household_members")
    .select("display_name, initials, role")
    .eq("household_id", parsed.data.householdId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || member.role === "viewer") return { error: t("errors.notAllowedToLog") };

  // Upsert-ignore on the client UUID makes outbox retries idempotent.
  const { error } = await supabase.from("entries").upsert(
    {
      id: parsed.data.id,
      household_id: parsed.data.householdId,
      profile_id: parsed.data.profileId,
      type: parsed.data.type,
      occurred_at: parsed.data.occurredAt,
      tz: parsed.data.tz,
      data: data.data as Json,
      note: parsed.data.note ?? null,
      flagged_for_doctor: parsed.data.flaggedForDoctor,
      logged_by: user.id,
      logged_by_name: member.display_name,
      logged_by_initials: member.initials,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  return error ? { error: error.message } : { success: true };
}

const UpdateEntrySchema = z.object({
  occurredAt: z.string().datetime({ offset: true }).optional(),
  profileId: z.string().uuid().optional(),
  data: z.record(z.unknown()).optional(),
  note: z.string().max(2000).nullable().optional(),
  flaggedForDoctor: z.boolean().optional(),
});

export type UpdateEntryPatch = z.infer<typeof UpdateEntrySchema>;

export async function updateEntry(entryId: string, patch: UpdateEntryPatch): Promise<Result> {
  if (!z.string().uuid().safeParse(entryId).success) return { error: t("errors.invalidEntry") };
  const parsed = UpdateEntrySchema.safeParse(patch);
  if (!parsed.success) return { error: t("errors.invalidChange") };
  if (parsed.data.occurredAt && new Date(parsed.data.occurredAt).getTime() > Date.now() + 60_000) {
    return { error: t("errors.futureEntry") };
  }
  if (await isDemoMode()) return { success: true };

  const { supabase, user } = await authed();
  if (!user) return { error: t("errors.notSignedIn") };

  const { data: before } = await supabase.from("entries").select("*").eq("id", entryId).maybeSingle();
  if (!before) return { error: t("errors.entryNotFound") };
  if (parsed.data.data) {
    const valid = validateEntryData(before.type, parsed.data.data);
    if (!valid.success) return { error: valid.error };
  }

  const update = {
    ...(parsed.data.occurredAt ? { occurred_at: parsed.data.occurredAt } : {}),
    ...(parsed.data.profileId ? { profile_id: parsed.data.profileId } : {}),
    ...(parsed.data.data ? { data: parsed.data.data as Json } : {}),
    ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
    ...(parsed.data.flaggedForDoctor !== undefined ? { flagged_for_doctor: parsed.data.flaggedForDoctor } : {}),
    updated_at: new Date().toISOString(),
  };

  // RLS rejects the update unless the user wrote the entry or is an admin (ACC-09).
  const { data: after, error } = await supabase.from("entries").update(update).eq("id", entryId).select("*").maybeSingle();
  if (error) return { error: error.message };
  if (!after) return { error: t("errors.editOwnOnly") };

  await supabase.from("entry_revisions").insert({
    entry_id: entryId,
    household_id: before.household_id,
    changed_by: user.id,
    before: before as unknown as Json,
    after: after as unknown as Json,
  });
  return { success: true };
}

async function setDeleted(entryId: string, deletedAt: string | null): Promise<Result> {
  if (!z.string().uuid().safeParse(entryId).success) return { error: t("errors.invalidEntry") };
  if (await isDemoMode()) return { success: true };

  const { supabase, user } = await authed();
  if (!user) return { error: t("errors.notSignedIn") };

  const { data, error } = await supabase
    .from("entries")
    .update({ deleted_at: deletedAt, updated_at: new Date().toISOString() })
    .eq("id", entryId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  return data ? { success: true } : { error: t("errors.deleteOwnOnly") };
}

export async function deleteEntry(entryId: string): Promise<Result> {
  return setDeleted(entryId, new Date().toISOString());
}

export async function restoreEntry(entryId: string): Promise<Result> {
  return setDeleted(entryId, null);
}
