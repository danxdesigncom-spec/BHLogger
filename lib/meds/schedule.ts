// Medication rules: scheduled slots (computed, never stored), slot status (MED-08),
// the duplicate-dose guard (MED-07) and adherence (MED-10).

export interface MedLike {
  id: string;
  name: string;
  kind: "scheduled" | "prn";
  schedule: unknown;
  dose_window_min: number;
  min_interval_hours: number | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
}

export interface DoseLike {
  id: string;
  occurred_at: string;
  logged_by_name: string;
  deleted_at?: string | null;
  data: unknown;
}

interface DoseData {
  medication_id?: string;
  dose?: number;
  unit?: string;
  outcome?: string;
  scheduled_for?: string | null;
}

const doseData = (d: DoseLike) => (d.data ?? {}) as DoseData;
export const GIVEN_OUTCOMES = new Set(["given", "partial"]);

export function scheduleOf(med: MedLike): { times: string[]; days: number[] } | null {
  const s = med.schedule as { times?: string[]; days?: number[] } | null;
  if (med.kind !== "scheduled" || !s?.times?.length) return null;
  return { times: [...s.times].sort(), days: s.days?.length ? s.days : [0, 1, 2, 3, 4, 5, 6] };
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Scheduled dose times for one local calendar day. */
export function slotsForDay(med: MedLike, day: Date): Date[] {
  const s = scheduleOf(med);
  if (!s || !med.active) return [];
  const date = ymd(day);
  if (med.start_date && date < med.start_date) return [];
  if (med.end_date && date > med.end_date) return [];
  if (!s.days.includes(day.getDay())) return [];
  return s.times.map((t) => {
    const [h, m] = t.split(":").map(Number);
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    return d;
  });
}

export function slotsInRange(med: MedLike, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  while (day <= to) {
    for (const s of slotsForDay(med, day)) if (s >= from && s <= to) out.push(s);
    day.setDate(day.getDate() + 1);
  }
  return out;
}

export type SlotState = "given" | "missed_outcome" | "due" | "upcoming" | "not_logged";

export interface SlotStatus {
  slot: Date;
  state: SlotState;
  dose: DoseLike | null;
}

/** A dose belongs to a slot when it names that slot, or (legacy data) falls inside its window. */
export function doseForSlot(med: MedLike, slot: Date, doses: DoseLike[]): DoseLike | null {
  const mine = doses.filter((d) => !d.deleted_at && doseData(d).medication_id === med.id);
  const exact = mine.find((d) => doseData(d).scheduled_for && new Date(doseData(d).scheduled_for!).getTime() === slot.getTime());
  if (exact) return exact;
  const windowMs = med.dose_window_min * 60_000;
  return (
    mine.find((d) => !doseData(d).scheduled_for && Math.abs(new Date(d.occurred_at).getTime() - slot.getTime()) <= windowMs) ?? null
  );
}

export function slotStatus(med: MedLike, slot: Date, doses: DoseLike[], now: Date): SlotStatus {
  const dose = doseForSlot(med, slot, doses);
  if (dose) return { slot, dose, state: GIVEN_OUTCOMES.has(doseData(dose).outcome ?? "given") ? "given" : "missed_outcome" };
  const windowMs = med.dose_window_min * 60_000;
  const t = slot.getTime();
  if (now.getTime() > t + windowMs) return { slot, dose: null, state: "not_logged" };
  if (now.getTime() >= t - windowMs) return { slot, dose: null, state: "due" };
  return { slot, dose: null, state: "upcoming" };
}

/** Today's slots for a medication with their status. */
export function todaySlots(med: MedLike, doses: DoseLike[], now: Date): SlotStatus[] {
  return slotsForDay(med, now).map((s) => slotStatus(med, s, doses, now));
}

/** The slot a new dose should attach to: the earliest open slot that's due or not logged today. */
export function slotToFill(med: MedLike, doses: DoseLike[], now: Date): Date | null {
  const open = todaySlots(med, doses, now).filter((s) => s.state === "due" || s.state === "not_logged");
  if (!open.length) return null;
  const due = open.find((s) => s.state === "due");
  return (due ?? open[open.length - 1]).slot;
}

export function lastDose(med: MedLike, doses: DoseLike[]): DoseLike | null {
  return (
    doses
      .filter((d) => !d.deleted_at && doseData(d).medication_id === med.id && GIVEN_OUTCOMES.has(doseData(d).outcome ?? "given"))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0] ?? null
  );
}

export interface DuplicateConflict {
  reason: "interval" | "slot";
  dose: DoseLike;
  elapsedMin: number;
  intervalHours: number;
}

/**
 * MED-07: warn if the same medication was given within its minimum interval (the profile's duplicate
 * window, 60 min by default, when none is set), or the slot being filled is already marked given.
 */
export function duplicateCheck(
  med: MedLike,
  doses: DoseLike[],
  at: Date,
  slot: Date | null,
  defaultWindowMin = 60,
): DuplicateConflict | null {
  const intervalHours = med.min_interval_hours ?? defaultWindowMin / 60;
  if (slot) {
    const filled = doseForSlot(med, slot, doses);
    if (filled && GIVEN_OUTCOMES.has(doseData(filled).outcome ?? "given")) {
      return { reason: "slot", dose: filled, elapsedMin: minutesBetween(filled.occurred_at, at), intervalHours };
    }
  }
  const recent = doses
    .filter((d) => !d.deleted_at && doseData(d).medication_id === med.id && GIVEN_OUTCOMES.has(doseData(d).outcome ?? "given"))
    .filter((d) => Math.abs(at.getTime() - new Date(d.occurred_at).getTime()) < intervalHours * 3_600_000)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
  return recent ? { reason: "interval", dose: recent, elapsedMin: minutesBetween(recent.occurred_at, at), intervalHours } : null;
}

function minutesBetween(iso: string, at: Date) {
  return Math.max(0, Math.round((at.getTime() - new Date(iso).getTime()) / 60_000));
}

/** "1 h 5 min", "45 min", "2 h". */
export function formatElapsed(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} minutes`;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hour${h === 1 ? "" : "s"}`;
}

export interface Adherence {
  scheduled: number;
  given: number;
  partial: number;
  refused: number;
  spitUp: number;
  skipped: number;
  notLogged: number;
  pct: number | null;
}

/** MED-10: Given and Partial count as given; Refused, Spit up, Skipped and Not logged don't. Open windows are excluded. */
export function adherence(med: MedLike, doses: DoseLike[], from: Date, to: Date, now: Date): Adherence {
  const result: Adherence = { scheduled: 0, given: 0, partial: 0, refused: 0, spitUp: 0, skipped: 0, notLogged: 0, pct: null };
  for (const slot of slotsInRange(med, from, to < now ? to : now)) {
    const s = slotStatus(med, slot, doses, now);
    if (s.state === "due" || s.state === "upcoming") continue;
    result.scheduled += 1;
    const outcome = s.dose ? doseData(s.dose).outcome ?? "given" : null;
    if (outcome === "given") result.given += 1;
    else if (outcome === "partial") result.partial += 1;
    else if (outcome === "refused") result.refused += 1;
    else if (outcome === "spit_up_vomited") result.spitUp += 1;
    else if (outcome === "skipped") result.skipped += 1;
    else result.notLogged += 1;
  }
  result.pct = result.scheduled ? Math.round(((result.given + result.partial) / result.scheduled) * 100) : null;
  return result;
}

/** S06 wording: "nightly", "mornings", "midday", "2 times a day", "mornings, Mon–Fri". */
export function friendlySchedule(med: MedLike): string {
  const s = scheduleOf(med);
  if (!s) return "as needed";
  let when: string;
  if (s.times.length === 1) {
    const h = Number(s.times[0].split(":")[0]);
    when = h < 11 ? "mornings" : h < 15 ? "midday" : h < 18 ? "afternoons" : "nightly";
  } else {
    when = `${s.times.length} times a day`;
  }
  if (s.days.length === 7) return when;
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdays = s.days.length === 5 && [1, 2, 3, 4, 5].every((d) => s.days.includes(d));
  return `${when}, ${weekdays ? "Mon–Fri" : s.days.map((d) => names[d]).join(", ")}`;
}

export function describeSchedule(med: MedLike): string {
  const s = scheduleOf(med);
  if (!s) return "as needed";
  const times = s.times.map((t) => {
    const [h, m] = t.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  });
  const days = s.days.length === 7 ? "daily" : s.days.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ");
  return `${times.join(" and ")} ${days}`;
}
