import { z } from "zod";

export const MedicationDataSchema = z
  .object({
    medication_id: z.string().uuid(),
    dose: z.number().positive(),
    unit: z.string(),
    // MED-05: Given is the default path; other outcomes still save the entry
    outcome: z.enum(["given", "partial", "refused", "spit_up_vomited", "skipped"]),
    // Links a PRN/extra dose to its scheduled slot; null for unscheduled PRN
    scheduled_for: z.string().datetime({ offset: true }).nullable().default(null),
    // MED-06: chip key from option_lists (prn_reason module)
    prn_reason: z.string().nullable().default(null),
    // MED-07: true = caregiver confirmed despite duplicate-dose warning
    duplicate_override: z.boolean().default(false),
    // MED-12: follow-up answer added up to 60 min after PRN dose
    followup: z.enum(["helped", "somewhat", "didnt_help"]).nullable().default(null),
  })
  .strict();

export type MedicationData = z.infer<typeof MedicationDataSchema>;
