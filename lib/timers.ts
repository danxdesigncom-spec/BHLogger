// QL-11: timers for breastfeeding and activities. A running timer is a draft on this device, not an entry:
// it keeps its start time in IndexedDB, so it survives closing the app or locking the phone, and Stop saves
// one entry that runs from the start to the stop.
import Dexie, { type Table } from "dexie";

export type TimerModule = "eating" | "activity";

export interface RunningTimer {
  key: string;
  profileId: string;
  module: TimerModule;
  startedAt: string;
  data: Record<string, unknown>;
  /** What the card and toast say, e.g. "Breastfeed, left" or "Playground". */
  label: string;
}

const DB_NAME = "bl-timers";

class TimerDb extends Dexie {
  timers!: Table<RunningTimer, string>;
  constructor() {
    super(DB_NAME);
    this.version(1).stores({ timers: "key, profileId" });
  }
}

let db: TimerDb | null = null;
const store = () => (db ??= new TimerDb());

export const timerKey = (profileId: string, module: TimerModule) => `${profileId}:${module}`;

export async function startTimer(t: Omit<RunningTimer, "key">): Promise<void> {
  await store().timers.put({ ...t, key: timerKey(t.profileId, t.module) });
}

export async function listTimers(): Promise<RunningTimer[]> {
  return (await store().timers.toArray()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export async function clearTimer(key: string): Promise<void> {
  await store().timers.delete(key);
}

/** SET-07: a deleted profile's running timers leave this device. */
export async function clearTimersFor(profileId: string): Promise<void> {
  await store().timers.filter((t) => t.profileId === profileId).delete();
}

/** Sign-out and leaving demo mode: nothing about a running timer stays on the device. */
export async function clearAllTimers(): Promise<void> {
  db?.close();
  db = null;
  await Dexie.delete(DB_NAME);
}

/** Whole minutes from start to stop, at least 1 (entries store durations in minutes). */
export function timerMinutes(startedAt: string, stoppedAt: Date): number {
  return Math.max(1, Math.round((stoppedAt.getTime() - new Date(startedAt).getTime()) / 60_000));
}

/** "4:05", "12:30", "1:02:05". */
export function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
