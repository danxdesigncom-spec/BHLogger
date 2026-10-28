import type { MedicationChangeRow, MedicationRow } from "@/lib/data/types";

/** MED-09: dated change events for a medication save. Shared by both repos. */
export function medicationChangesFor(
  before: MedicationRow | null,
  after: MedicationRow,
  effectiveFrom?: string,
): Pick<MedicationChangeRow, "medication_id" | "change_type" | "effective_at" | "before" | "after">[] {
  const today = new Date().toISOString().slice(0, 10);
  const effective = effectiveFrom ?? today;
  if (!before) {
    return [{ medication_id: after.id, change_type: "started", effective_at: after.start_date ?? today, before: {}, after: { default_dose: after.default_dose, dose_unit: after.dose_unit, schedule: after.schedule } }];
  }
  const out: ReturnType<typeof medicationChangesFor> = [];
  if (before.default_dose !== after.default_dose || before.dose_unit !== after.dose_unit) {
    out.push({ medication_id: after.id, change_type: "dose_changed", effective_at: effective, before: { default_dose: before.default_dose, dose_unit: before.dose_unit }, after: { default_dose: after.default_dose, dose_unit: after.dose_unit } });
  }
  if (JSON.stringify(before.schedule) !== JSON.stringify(after.schedule) || before.kind !== after.kind) {
    out.push({ medication_id: after.id, change_type: "schedule_changed", effective_at: effective, before: { kind: before.kind, schedule: before.schedule }, after: { kind: after.kind, schedule: after.schedule } });
  }
  if (before.active && !after.active) {
    out.push({ medication_id: after.id, change_type: "stopped", effective_at: after.end_date ?? effective, before: {}, after: {} });
  }
  if (!before.active && after.active) {
    out.push({ medication_id: after.id, change_type: "started", effective_at: effective, before: {}, after: { default_dose: after.default_dose, dose_unit: after.dose_unit } });
  }
  return out;
}
