import type { Database, Json } from "@/lib/supabase/types";

type Tables = Database["public"]["Tables"];
export type EntryRow = Tables["entries"]["Row"];
export type RevisionRow = Tables["entry_revisions"]["Row"];
export type MedicationRow = Tables["medications"]["Row"];
export type MedicationChangeRow = Tables["medication_changes"]["Row"];
export type AppointmentRow = Tables["appointments"]["Row"];
export type OptionRow = Tables["option_lists"]["Row"];

/** An entry plus local sync state; "pending" means it's still in the outbox (TL-01). */
export type LocalEntry = EntryRow & { _sync?: "synced" | "pending" | "failed" };

export interface EntryQuery {
  profileId?: string;
  types?: string[];
  from?: string;
  to?: string;
  /** "only" returns the Recently deleted list (TL-06). */
  deleted?: "exclude" | "only";
  limit?: number;
}

export interface NewEntry {
  id: string;
  householdId: string;
  profileId: string;
  type: string;
  occurredAt: string;
  tz: string;
  data: Record<string, unknown>;
  note?: string;
  flaggedForDoctor: boolean;
}

export interface EntryPatch {
  occurredAt?: string;
  profileId?: string;
  data?: Record<string, unknown>;
  note?: string | null;
  flaggedForDoctor?: boolean;
}

export interface MedicationInput {
  id?: string;
  profileId: string;
  name: string;
  form: string | null;
  strength: string | null;
  defaultDose: number;
  doseUnit: string;
  kind: "scheduled" | "prn";
  schedule: { times: string[]; days: number[] } | null;
  doseWindowMin: number;
  minIntervalHours: number | null;
  purpose: string | null;
  prescriber: string | null;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  /** For an edit that changes dose or schedule: the date the change takes effect (MED-09). */
  effectiveFrom?: string;
}

export type Result = { success: true } | { error: string };

export interface Actor {
  userId: string;
  name: string;
  initials: string;
  role: "admin" | "caregiver" | "viewer";
}

export interface Repo {
  mode: "live" | "demo";
  listEntries(q: EntryQuery): Promise<LocalEntry[]>;
  latestEntry(profileId: string, type: string, match?: Record<string, string>): Promise<LocalEntry | null>;
  getEntry(id: string): Promise<LocalEntry | null>;
  saveEntry(e: NewEntry): Promise<Result>;
  updateEntry(id: string, patch: EntryPatch): Promise<Result>;
  deleteEntry(id: string): Promise<Result>;
  restoreEntry(id: string): Promise<Result>;
  listRevisions(entryId: string): Promise<RevisionRow[]>;
  listMedications(profileId: string): Promise<MedicationRow[]>;
  saveMedication(m: MedicationInput): Promise<Result>;
  listMedicationChanges(profileId: string): Promise<MedicationChangeRow[]>;
  listAppointments(profileId: string): Promise<AppointmentRow[]>;
  addAppointment(a: { profileId: string; date: string; provider: string | null; notes: string | null }): Promise<Result>;
  listOptions(profileId: string, module: string): Promise<OptionRow[]>;
  addOption(o: { profileId: string; module: string; label: string; icon: string | null }): Promise<Result>;
  archiveOption(id: string): Promise<Result>;
  updateProfileSettings(profileId: string, settings: Record<string, unknown>): Promise<Result>;
  /** Pending outbox count, for the offline banner (M8). */
  pendingCount(): Promise<number>;
}

export function matchesData(data: Json, match?: Record<string, string>): boolean {
  if (!match) return true;
  const d = (data ?? {}) as Record<string, unknown>;
  return Object.entries(match).every(([k, v]) => String(d[k]) === v);
}

export function slugify(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "custom";
}

/** Pending (outbox) entries plus server rows: pending first when newer, never duplicated once synced (AT-08). */
export function mergeEntries(pending: LocalEntry[], rows: LocalEntry[], q: EntryQuery): LocalEntry[] {
  if (q.deleted === "only") return rows;
  const seen = new Set(rows.map((r) => r.id));
  const extra = pending.filter(
    (e) =>
      !seen.has(e.id) &&
      (!q.profileId || e.profile_id === q.profileId) &&
      (!q.types || q.types.includes(e.type)) &&
      (!q.from || e.occurred_at >= q.from) &&
      (!q.to || e.occurred_at <= q.to),
  );
  return [...extra, ...rows].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}
