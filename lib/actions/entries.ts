"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { isDemoMode } from "@/app/auth/demo/actions";

const SaveEntrySchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  profileId: z.string().uuid(),
  type: z.string(),
  occurredAt: z.string(),
  tz: z.string(),
  data: z.record(z.unknown()).default({}),
  note: z.string().optional(),
  flaggedForDoctor: z.boolean().default(false),
});

export type SaveEntryInput = z.infer<typeof SaveEntrySchema>;

export async function saveEntry(input: SaveEntryInput) {
  const parsed = SaveEntrySchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid entry data." };
  if (await isDemoMode()) return { success: true as const, entryId: parsed.data.id };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: member } = await supabase
    .from("household_members")
    .select("id, display_name, initials, role")
    .eq("household_id", parsed.data.householdId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member || member.role === "viewer") return { error: "Not authorized to log." };

  const { error } = await supabase.from("entries").insert({
    id: parsed.data.id,
    household_id: parsed.data.householdId,
    profile_id: parsed.data.profileId,
    type: parsed.data.type,
    occurred_at: parsed.data.occurredAt,
    tz: parsed.data.tz,
    data: parsed.data.data as import("@/lib/supabase/types").Json,
    note: parsed.data.note ?? null,
    flagged_for_doctor: parsed.data.flaggedForDoctor,
    logged_by: user.id,
    logged_by_name: member.display_name,
    logged_by_initials: member.initials,
  });

  if (error) return { error: error.message };
  return { success: true as const, entryId: parsed.data.id };
}

export async function undoEntry(entryId: string, householdId: string) {
  if (!z.string().uuid().safeParse(entryId).success) return { error: "Invalid entry ID." };
  if (await isDemoMode()) return { success: true as const };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify the entry belongs to this household and was logged by this user
  const { data: entry } = await supabase
    .from("entries")
    .select("id, logged_by")
    .eq("id", entryId)
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!entry) return { error: "Entry not found." };

  const { data: member } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .maybeSingle();

  // Only the logger or an admin can undo
  if (entry.logged_by !== user.id && member?.role !== "admin") {
    return { error: "Not authorized." };
  }

  const { error } = await supabase
    .from("entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", entryId);

  if (error) return { error: error.message };
  return { success: true as const };
}
