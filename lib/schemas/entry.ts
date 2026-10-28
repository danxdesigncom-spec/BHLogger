import { z } from "zod";
import { ActivityDataSchema } from "./entry-activity";
import { BathroomDataSchema } from "./entry-bathroom";
import { EatingDataSchema } from "./entry-eating";
import { MedicationDataSchema } from "./entry-medication";
import { MoodDataSchema } from "./entry-mood";

// ─── Base fields (DB row minus type and data) ─────────────────────────────────

export const EntryBaseSchema = z.object({
  id: z.string().uuid(),
  household_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  occurred_at: z.string().datetime({ offset: true }),
  tz: z.string(),
  ended_at: z.string().datetime({ offset: true }).nullable(),
  note: z.string().nullable(),
  flagged_for_doctor: z.boolean(),
  logged_by: z.string().uuid(),
  logged_by_name: z.string(),
  logged_by_initials: z.string(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  deleted_at: z.string().datetime({ offset: true }).nullable(),
  schema_version: z.number().int(),
});

// ─── Typed entry schemas ──────────────────────────────────────────────────────

export const BathroomEntrySchema = EntryBaseSchema.extend({
  type: z.literal("bathroom"),
  data: BathroomDataSchema,
});

export const EatingEntrySchema = EntryBaseSchema.extend({
  type: z.literal("eating"),
  data: EatingDataSchema,
});

export const ActivityEntrySchema = EntryBaseSchema.extend({
  type: z.literal("activity"),
  data: ActivityDataSchema,
});

export const MoodEntrySchema = EntryBaseSchema.extend({
  type: z.literal("mood"),
  data: MoodDataSchema,
});

export const MedicationEntrySchema = EntryBaseSchema.extend({
  type: z.literal("medication"),
  data: MedicationDataSchema,
});

// Forward-compatible fallback for unknown / Phase-2 types.
export const UnknownEntrySchema = EntryBaseSchema.extend({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

// Typed discriminated union (known types only).
export const EntrySchema = z.discriminatedUnion("type", [
  BathroomEntrySchema,
  EatingEntrySchema,
  ActivityEntrySchema,
  MoodEntrySchema,
  MedicationEntrySchema,
]);

// ─── Per-type data validation ────────────────────────────────────────────────
// Known types get their strict schema; unknown (Phase 2+) types accept any object (QL-14).

const DATA_SCHEMAS: Record<string, z.ZodTypeAny> = {
  bathroom: BathroomDataSchema,
  eating: EatingDataSchema,
  activity: ActivityDataSchema,
  mood: MoodDataSchema,
  medication: MedicationDataSchema,
};

export function validateEntryData(type: string, data: unknown):
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string } {
  const schema = DATA_SCHEMAS[type] ?? z.record(z.string(), z.unknown());
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data as Record<string, unknown> };
  const issue = result.error.issues[0];
  return { success: false, error: `${type}.${issue?.path.join(".") || "data"}: ${issue?.message ?? "invalid"}` };
}

// ─── parseEntry ───────────────────────────────────────────────────────────────
// Parses a DB row; falls back to UnknownEntrySchema for future types so the
// app never throws on entries added in Phase 2+ (QL-14).

export function parseEntry(raw: unknown): Entry | UnknownEntry {
  const result = EntrySchema.safeParse(raw);
  if (result.success) return result.data;
  return UnknownEntrySchema.parse(raw);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type BathroomEntry  = z.infer<typeof BathroomEntrySchema>;
export type EatingEntry    = z.infer<typeof EatingEntrySchema>;
export type ActivityEntry  = z.infer<typeof ActivityEntrySchema>;
export type MoodEntry      = z.infer<typeof MoodEntrySchema>;
export type MedicationEntry = z.infer<typeof MedicationEntrySchema>;
export type UnknownEntry   = z.infer<typeof UnknownEntrySchema>;
export type KnownEntry     = z.infer<typeof EntrySchema>;
export type Entry          = KnownEntry | UnknownEntry;
