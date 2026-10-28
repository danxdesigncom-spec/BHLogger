"use client";

import Dexie, { type Table } from "dexie";
import { generateHouseholdData, SEED_IDS } from "@/lib/demo/generate";
import { validateEntryData } from "@/lib/schemas/entry";
import { medicationChangesFor } from "@/lib/meds/changes";
import type { Json } from "@/lib/supabase/types";
import {
  matchesData, slugify,
  type Actor, type AppointmentRow, type EntryQuery, type LocalEntry, type MedicationChangeRow, type MedicationInput,
  type MedicationRow, type OptionRow, type Repo, type Result, type RevisionRow,
} from "./types";
import { t } from "@/lib/i18n";

const DEMO_DB = "bl-demo";
const DATA_VERSION = 5;

class DemoDb extends Dexie {
  entries!: Table<LocalEntry, string>;
  revisions!: Table<RevisionRow, string>;
  medications!: Table<MedicationRow, string>;
  medicationChanges!: Table<MedicationChangeRow, string>;
  appointments!: Table<AppointmentRow, string>;
  options!: Table<OptionRow, string>;
  profileSettings!: Table<{ profile_id: string; settings: Record<string, unknown> }, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super(DEMO_DB);
    this.version(1).stores({
      entries: "id, profile_id, occurred_at",
      revisions: "id, entry_id",
      medications: "id, profile_id",
      medicationChanges: "id, medication_id",
      appointments: "id, profile_id",
      options: "id, profile_id",
      profileSettings: "profile_id",
      meta: "key",
    });
  }
}

let dbPromise: Promise<DemoDb> | null = null;

function openDb(): Promise<DemoDb> {
  dbPromise ??= (async () => {
    const db = new DemoDb();
    const seeded = await db.meta.get("version");
    const seededDay = await db.meta.get("day");
    const today = new Date().toDateString();
    // Sample data follows the clock: a new day regenerates the story so "today" is never empty.
    if (seeded?.value !== DATA_VERSION || seededDay?.value !== today) {
      const data = generateHouseholdData({ anchor: new Date(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
      await db.transaction("rw", [db.entries, db.revisions, db.medications, db.medicationChanges, db.appointments, db.options, db.profileSettings, db.meta], async () => {
        await Promise.all([db.entries.clear(), db.revisions.clear(), db.medications.clear(), db.medicationChanges.clear(), db.appointments.clear(), db.options.clear(), db.profileSettings.clear()]);
        await db.entries.bulkPut(data.entries);
        await db.medications.bulkPut(data.medications);
        await db.medicationChanges.bulkPut(data.medicationChanges);
        await db.appointments.bulkPut(data.appointments);
        await db.profileSettings.bulkPut(data.profiles.map((p) => ({ profile_id: p.id, settings: p.settings as Record<string, unknown> })));
        await db.meta.put({ key: "version", value: DATA_VERSION });
        await db.meta.put({ key: "day", value: today });
      });
    }
    return db;
  })();
  return dbPromise;
}

export async function clearDemoData(): Promise<void> {
  dbPromise = null;
  await Dexie.delete(DEMO_DB);
}

export async function demoProfileSettings(): Promise<Record<string, Record<string, unknown>>> {
  const db = await openDb();
  const rows = await db.profileSettings.toArray();
  return Object.fromEntries(rows.map((r) => [r.profile_id, r.settings]));
}

const ok: Result = { success: true };
const now = () => new Date().toISOString();

export function createDemoRepo(actor: Actor): Repo {
  const filterEntries = (rows: LocalEntry[], q: EntryQuery) =>
    rows
      .filter((e) => (q.deleted === "only" ? e.deleted_at !== null : e.deleted_at === null))
      .filter((e) => !q.types || q.types.includes(e.type))
      .filter((e) => !q.from || e.occurred_at >= q.from)
      .filter((e) => !q.to || e.occurred_at <= q.to)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .slice(0, q.limit ?? Infinity);

  const revise = async (db: DemoDb, before: LocalEntry, after: LocalEntry) => {
    await db.revisions.put({
      id: crypto.randomUUID(), entry_id: before.id, household_id: before.household_id,
      changed_by: actor.userId, changed_at: now(), before: before as unknown as Json, after: after as unknown as Json,
    });
  };

  return {
    mode: "demo",

    async listEntries(q) {
      const db = await openDb();
      const rows = q.profileId ? await db.entries.where("profile_id").equals(q.profileId).toArray() : await db.entries.toArray();
      return filterEntries(rows, q);
    },

    async latestEntry(profileId, type, match) {
      const db = await openDb();
      const rows = await db.entries.where("profile_id").equals(profileId).toArray();
      return (
        rows
          .filter((e) => e.type === type && e.deleted_at === null && matchesData(e.data, match))
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0] ?? null
      );
    },

    async getEntry(id) {
      return (await (await openDb()).entries.get(id)) ?? null;
    },

    async saveEntry(e) {
      const valid = validateEntryData(e.type, e.data);
      if (!valid.success) return { error: valid.error };
      const db = await openDb();
      if (await db.entries.get(e.id)) return ok;
      await db.entries.put({
        id: e.id, household_id: e.householdId, profile_id: e.profileId, type: e.type, occurred_at: e.occurredAt, tz: e.tz,
        ended_at: null, data: valid.data as Json, note: e.note ?? null, flagged_for_doctor: e.flaggedForDoctor,
        logged_by: actor.userId, logged_by_name: actor.name, logged_by_initials: actor.initials,
        created_at: now(), updated_at: now(), deleted_at: null, schema_version: 1, _sync: "synced",
      });
      return ok;
    },

    async updateEntry(id, patch) {
      const db = await openDb();
      const before = await db.entries.get(id);
      if (!before) return { error: t("errors.entryNotFound") };
      if (before.logged_by !== actor.userId && actor.role !== "admin") return { error: t("errors.editOwnOnly") };
      if (patch.data) {
        const valid = validateEntryData(before.type, patch.data);
        if (!valid.success) return { error: valid.error };
      }
      const after: LocalEntry = {
        ...before,
        ...(patch.occurredAt ? { occurred_at: patch.occurredAt } : {}),
        ...(patch.profileId ? { profile_id: patch.profileId } : {}),
        ...(patch.data ? { data: patch.data as Json } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        ...(patch.flaggedForDoctor !== undefined ? { flagged_for_doctor: patch.flaggedForDoctor } : {}),
        updated_at: now(),
      };
      await db.entries.put(after);
      await revise(db, before, after);
      return ok;
    },

    async deleteEntry(id) {
      const db = await openDb();
      const e = await db.entries.get(id);
      if (!e) return { error: t("errors.entryNotFound") };
      if (e.logged_by !== actor.userId && actor.role !== "admin") return { error: t("errors.deleteOwnOnly") };
      await db.entries.update(id, { deleted_at: now(), updated_at: now() });
      return ok;
    },

    async restoreEntry(id) {
      const db = await openDb();
      await db.entries.update(id, { deleted_at: null, updated_at: now() });
      return ok;
    },

    async listRevisions(entryId) {
      const db = await openDb();
      return (await db.revisions.where("entry_id").equals(entryId).toArray()).sort((a, b) => b.changed_at.localeCompare(a.changed_at));
    },

    async listMedications(profileId) {
      const db = await openDb();
      return (await db.medications.where("profile_id").equals(profileId).toArray()).sort((a, b) => a.name.localeCompare(b.name));
    },

    async saveMedication(m: MedicationInput) {
      const db = await openDb();
      const existing = m.id ? await db.medications.get(m.id) : undefined;
      const id = m.id ?? crypto.randomUUID();
      const row: MedicationRow = {
        id, household_id: SEED_IDS.household, profile_id: m.profileId, name: m.name, form: m.form, strength: m.strength,
        default_dose: m.defaultDose, dose_unit: m.doseUnit, kind: m.kind, schedule: m.schedule as Json, dose_window_min: m.doseWindowMin,
        min_interval_hours: m.minIntervalHours, purpose: m.purpose, prescriber: m.prescriber, instructions: m.instructions,
        start_date: m.startDate, end_date: m.endDate, active: m.active, created_at: existing?.created_at ?? now(), updated_at: now(),
      };
      await db.medications.put(row);
      for (const c of medicationChangesFor(existing ?? null, row, m.effectiveFrom)) {
        await db.medicationChanges.put({ ...c, id: crypto.randomUUID(), household_id: row.household_id, changed_by: actor.userId, created_at: now() });
      }
      return ok;
    },

    async listMedicationChanges(profileId) {
      const db = await openDb();
      const medIds = new Set((await db.medications.where("profile_id").equals(profileId).toArray()).map((m) => m.id));
      return (await db.medicationChanges.toArray()).filter((c) => medIds.has(c.medication_id)).sort((a, b) => a.effective_at.localeCompare(b.effective_at));
    },

    async listAppointments(profileId) {
      const db = await openDb();
      return (await db.appointments.where("profile_id").equals(profileId).toArray()).sort((a, b) => a.date.localeCompare(b.date));
    },

    async addAppointment(a) {
      const db = await openDb();
      await db.appointments.put({ id: crypto.randomUUID(), household_id: SEED_IDS.household, profile_id: a.profileId, date: a.date, provider: a.provider, notes: a.notes, created_at: now() });
      return ok;
    },

    async listOptions(profileId, module) {
      const db = await openDb();
      return (await db.options.where("profile_id").equals(profileId).toArray()).filter((o) => o.module === module && !o.archived);
    },

    async addOption(o) {
      const db = await openDb();
      await db.options.put({
        id: crypto.randomUUID(), household_id: SEED_IDS.household, profile_id: o.profileId, module: o.module,
        key: `opt_${slugify(o.label)}`, label: o.label, icon: o.icon, sort_order: 0, archived: false, created_at: now(),
      });
      return ok;
    },

    async archiveOption(id) {
      const db = await openDb();
      await db.options.update(id, { archived: true });
      return ok;
    },

    async updateProfileSettings(profileId, settings) {
      const db = await openDb();
      const current = (await db.profileSettings.get(profileId))?.settings ?? {};
      await db.profileSettings.put({ profile_id: profileId, settings: { ...current, ...settings } });
      return ok;
    },

    async pendingCount() {
      return 0;
    },
  };
}
