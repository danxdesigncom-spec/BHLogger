"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/app/auth/demo/actions";
import { medicationChangesFor } from "@/lib/meds/changes";
import { slugify } from "@/lib/data/types";
import type { Json } from "@/lib/supabase/types";
import { t } from "@/lib/i18n";

type Result = { success: true } | { error: string };

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const MedicationSchema = z
  .object({
    id: z.string().uuid().optional(),
    profileId: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    form: z.string().max(40).nullable(),
    strength: z.string().max(40).nullable(),
    defaultDose: z.number().positive().max(10000),
    doseUnit: z.string().min(1).max(20),
    kind: z.enum(["scheduled", "prn"]),
    schedule: z.object({ times: z.array(time).min(1).max(8), days: z.array(z.number().int().min(0).max(6)).min(1) }).nullable(),
    doseWindowMin: z.number().int().min(0).max(240),
    minIntervalHours: z.number().positive().max(72).nullable(),
    purpose: z.string().max(120).nullable(),
    prescriber: z.string().max(80).nullable(),
    instructions: z.string().max(500).nullable(),
    startDate: date.nullable(),
    endDate: date.nullable(),
    active: z.boolean(),
    effectiveFrom: date.optional(),
  })
  .refine((m) => m.kind === "prn" || m.schedule !== null, { message: "schedule_required" });

export type MedicationInputParsed = z.infer<typeof MedicationSchema>;

export async function saveMedication(input: unknown): Promise<Result> {
  const parsed = MedicationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message === "schedule_required" ? t("meds.form.scheduleRequired") : t("errors.invalidMedication") };
  }
  if (await isDemoMode()) return { success: true };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: t("errors.notSignedIn") };

  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", parsed.data.profileId).maybeSingle();
  if (!profile) return { error: t("errors.profileNotFound") };

  const m = parsed.data;
  const row = {
    household_id: profile.household_id,
    profile_id: m.profileId,
    name: m.name,
    form: m.form,
    strength: m.strength,
    default_dose: m.defaultDose,
    dose_unit: m.doseUnit,
    kind: m.kind,
    schedule: (m.kind === "scheduled" ? m.schedule : null) as Json,
    dose_window_min: m.doseWindowMin,
    min_interval_hours: m.minIntervalHours,
    purpose: m.purpose,
    prescriber: m.prescriber,
    instructions: m.instructions,
    start_date: m.startDate,
    end_date: m.endDate,
    active: m.active,
    updated_at: new Date().toISOString(),
  };

  const before = m.id ? (await supabase.from("medications").select("*").eq("id", m.id).maybeSingle()).data : null;
  const { data: saved, error } = m.id
    ? await supabase.from("medications").update(row).eq("id", m.id).select("*").single()
    : await supabase.from("medications").insert(row).select("*").single();
  if (error || !saved) return { error: error?.message ?? "Couldn't save the medication." };

  const changes = medicationChangesFor(before, saved, m.effectiveFrom);
  if (changes.length) {
    const { error: changeErr } = await supabase
      .from("medication_changes")
      .insert(changes.map((c) => ({ ...c, household_id: saved.household_id, changed_by: user.id })));
    if (changeErr) return { error: changeErr.message };
  }
  return { success: true };
}

export async function addAppointment(input: { profileId: string; date: string; provider: string | null; notes: string | null }): Promise<Result> {
  const parsed = z.object({ profileId: z.string().uuid(), date, provider: z.string().max(80).nullable(), notes: z.string().max(500).nullable() }).safeParse(input);
  if (!parsed.success) return { error: t("errors.invalidAppointment") };
  if (await isDemoMode()) return { success: true };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", parsed.data.profileId).maybeSingle();
  if (!profile) return { error: t("errors.profileNotFound") };
  const { error } = await supabase.from("appointments").insert({
    household_id: profile.household_id, profile_id: parsed.data.profileId, date: parsed.data.date,
    provider: parsed.data.provider, notes: parsed.data.notes,
  });
  return error ? { error: error.message } : { success: true };
}

export async function addOption(input: { profileId: string; module: string; label: string; icon: string | null }): Promise<Result> {
  const parsed = z.object({
    profileId: z.string().uuid(),
    module: z.enum(["activity", "food", "feeling", "behavior", "prn_reason"]),
    label: z.string().trim().min(1).max(40),
    icon: z.string().max(40).nullable(),
  }).safeParse(input);
  if (!parsed.success) return { error: t("errors.shortName") };
  if (await isDemoMode()) return { success: true };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", parsed.data.profileId).maybeSingle();
  if (!profile) return { error: t("errors.profileNotFound") };
  const { error } = await supabase.from("option_lists").insert({
    household_id: profile.household_id, profile_id: parsed.data.profileId, module: parsed.data.module,
    key: `opt_${slugify(parsed.data.label)}`, label: parsed.data.label, icon: parsed.data.icon,
  });
  return error ? { error: error.message } : { success: true };
}

export async function archiveOption(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { error: t("errors.invalidOption") };
  if (await isDemoMode()) return { success: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from("option_lists").update({ archived: true }).eq("id", id).select("id").maybeSingle();
  if (error) return { error: error.message };
  return data ? { success: true } : { error: t("errors.archiveOption") };
}

export async function updateProfileSettings(profileId: string, settings: Record<string, unknown>): Promise<Result> {
  const parsed = z.object({
    bm_alert_days: z.number().int().min(1).max(14).nullable().optional(),
    wet_diaper_min: z.number().int().min(1).max(20).nullable().optional(),
    wet_diaper_by: time.optional(),
    med_dose_window_min: z.number().int().min(0).max(240).optional(),
    med_duplicate_window_min: z.number().int().min(0).max(1440).optional(),
    tile_order: z.array(z.string()).optional(),
    hidden_options: z.record(z.array(z.string().max(60)).max(60)).optional(),
    hidden_tiles: z.array(z.string()).optional(),
  }).strict().safeParse(settings);
  if (!parsed.success || !z.string().uuid().safeParse(profileId).success) return { error: t("errors.invalidSettings") };
  if (await isDemoMode()) return { success: true };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("settings").eq("id", profileId).maybeSingle();
  if (!profile) return { error: t("errors.profileNotFound") };
  const merged = { ...(profile.settings as Record<string, unknown>), ...parsed.data };
  const { data, error } = await supabase.from("profiles").update({ settings: merged as Json }).eq("id", profileId).select("id").maybeSingle();
  if (error) return { error: error.message };
  return data ? { success: true } : { error: t("errors.adminSettings") };
}
