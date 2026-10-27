import { z } from "zod";

// ─── Household settings (stored in households.settings jsonb) ────────────────
// Defaults mirror US locale (oz, 12h, Sunday week start).

export const HouseholdSettingsSchema = z
  .object({
    volume_unit: z.enum(["ml", "oz"]).default("oz"),
    time_format: z.enum(["12h", "24h"]).default("12h"),
    week_start: z.enum(["sunday", "monday"]).default("sunday"),
    locale: z.string().default("en"),
  })
  .catchall(z.unknown()); // forward-compat: extra keys are preserved, not stripped

export type HouseholdSettings = z.infer<typeof HouseholdSettingsSchema>;

// ─── Profile settings (stored in profiles.settings jsonb) ────────────────────

export const ProfileSettingsSchema = z
  .object({
    // Alert after this many days without a BM (BTH-08). Null = disabled.
    bm_alert_days: z.number().int().min(1).nullable().default(3),
    // Minimum wet diapers per day before an alert (BTH-09). Null = disabled.
    wet_diaper_min: z.number().int().min(1).nullable().default(null),
    // How long before/after a scheduled dose is still counted as on-time (MED-02).
    med_dose_window_min: z.number().int().min(0).default(60),
    // Duplicate-dose guard window in minutes (MED-07).
    med_duplicate_window_min: z.number().int().min(0).default(60),
  })
  .catchall(z.unknown());

export type ProfileSettings = z.infer<typeof ProfileSettingsSchema>;

// ─── Care-card shape (stored in profiles.care_card jsonb) ────────────────────

export const CareCardSchema = z
  .object({
    allergies: z.array(z.string()).default([]),
    conditions: z.array(z.string()).default([]),
    communication_notes: z.string().optional(),
    calming_strategies: z.array(z.string()).default([]),
    emergency_contacts: z
      .array(
        z.object({
          name: z.string(),
          relationship: z.string().optional(),
          phone: z.string().optional(),
        }),
      )
      .default([]),
    doctor: z
      .object({ name: z.string().optional(), phone: z.string().optional() })
      .optional(),
  })
  .catchall(z.unknown());

export type CareCard = z.infer<typeof CareCardSchema>;
