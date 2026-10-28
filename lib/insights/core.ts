// Insights math (DSH-01 to DSH-08, PAT-01 to PAT-03). Pure functions over entry rows.
// Day and time-of-day use each entry's own IANA time zone (PRD section 11).

export interface InsightEntry {
  id: string;
  type: string;
  occurred_at: string;
  tz: string;
  data: unknown;
  flagged_for_doctor?: boolean;
  deleted_at?: string | null;
  logged_by_name?: string;
}

type D = Record<string, unknown>;
export const dataOf = (e: InsightEntry) => (e.data ?? {}) as D;

const formatters = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
    } catch {
      f = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
    }
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Local calendar date, hour and weekday of an entry in its own time zone. */
export function localParts(e: { occurred_at: string; tz: string }): { day: string; hour: number; minute: number; weekday: number } {
  const parts = Object.fromEntries(fmt(e.tz || "UTC").formatToParts(new Date(e.occurred_at)).map((p) => [p.type, p.value]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function eachDay(from: Date, to: Date): string[] {
  const out: string[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    out.push(ymdLocal(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

const active = (es: InsightEntry[]) => es.filter((e) => !e.deleted_at);
export const isBm = (e: InsightEntry) => e.type === "bathroom" && ["bm", "both"].includes(String(dataOf(e).kind));
export const isWet = (e: InsightEntry) => e.type === "bathroom" && ["pee", "both"].includes(String(dataOf(e).kind));

// ─── Daily series ────────────────────────────────────────────────────────────

export interface MoodDay { day: string; avg: number | null; min: number | null; max: number | null; n: number; dayRating: boolean }

/** DSH-05: daily mood; a day-level rating (MOOD-06) takes priority over the average of moment logs. */
export function moodDaily(entries: InsightEntry[], days: string[]): MoodDay[] {
  const byDay = new Map<string, { moments: number[]; day?: number }>();
  for (const e of active(entries)) {
    if (e.type !== "mood") continue;
    const level = Number(dataOf(e).level);
    if (!level) continue;
    const k = localParts(e).day;
    const slot = byDay.get(k) ?? { moments: [] };
    if (dataOf(e).scope === "day") slot.day = level;
    else slot.moments.push(level);
    byDay.set(k, slot);
  }
  return days.map((day) => {
    const s = byDay.get(day);
    if (!s) return { day, avg: null, min: null, max: null, n: 0, dayRating: false };
    const all = s.moments;
    return {
      day,
      avg: round1(s.day ?? mean(all)),
      min: all.length ? Math.min(...all) : s.day ?? null,
      max: all.length ? Math.max(...all) : s.day ?? null,
      n: all.length + (s.day ? 1 : 0),
      dayRating: s.day !== undefined,
    };
  });
}

export function countDaily(entries: InsightEntry[], days: string[], pred: (e: InsightEntry) => boolean): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of active(entries)) if (pred(e)) counts.set(localParts(e).day, (counts.get(localParts(e).day) ?? 0) + 1);
  return days.map((day) => ({ day, count: counts.get(day) ?? 0 }));
}

export function sumDaily(entries: InsightEntry[], days: string[], pred: (e: InsightEntry) => boolean, value: (e: InsightEntry) => number): { day: string; value: number }[] {
  const sums = new Map<string, number>();
  for (const e of active(entries)) if (pred(e)) sums.set(localParts(e).day, (sums.get(localParts(e).day) ?? 0) + value(e));
  return days.map((day) => ({ day, value: sums.get(day) ?? 0 }));
}

export function rollingAverage(values: number[], window = 7): (number | null)[] {
  return values.map((_, i) => (i + 1 < window ? null : round1(mean(values.slice(i + 1 - window, i + 1)))));
}

/** DSH-03: the longest stretch between BMs inside the range, in days. */
export function longestBmGap(entries: InsightEntry[], from: Date, to: Date): { days: number; start: string; end: string } | null {
  const times = active(entries).filter(isBm).map((e) => new Date(e.occurred_at).getTime()).filter((t) => t >= from.getTime() && t <= to.getTime()).sort((a, b) => a - b);
  const points = [from.getTime(), ...times, to.getTime()];
  let best: { days: number; start: string; end: string } | null = null;
  for (let i = 1; i < points.length; i++) {
    const gap = (points[i] - points[i - 1]) / 86_400_000;
    if (!best || gap > best.days) best = { days: Math.round(gap * 10) / 10, start: new Date(points[i - 1]).toISOString(), end: new Date(points[i]).toISOString() };
  }
  return times.length ? best : null;
}

// ─── Time-of-day blocks (PAT-01, DSH-05 heatmap) ─────────────────────────────

export const BLOCKS = [
  { key: "morning", label: "Morning", from: 7, to: 10 },
  { key: "midday", label: "Midday", from: 10, to: 13 },
  { key: "early_pm", label: "1–4 PM", from: 13, to: 16 },
  { key: "late_pm", label: "4–7 PM", from: 16, to: 19 },
  { key: "evening", label: "Evening", from: 19, to: 22 },
  { key: "night", label: "Night", from: 22, to: 31 },
] as const;

export function blockOf(hour: number) {
  const h = hour < 7 ? hour + 24 : hour;
  return BLOCKS.find((b) => h >= b.from && h < b.to) ?? BLOCKS[5];
}

export function moodByBlock(entries: InsightEntry[]) {
  const sums = new Map<string, number[]>();
  for (const e of active(entries)) {
    if (e.type !== "mood" || dataOf(e).scope === "day") continue;
    const k = blockOf(localParts(e).hour).key;
    sums.set(k, [...(sums.get(k) ?? []), Number(dataOf(e).level)]);
  }
  return BLOCKS.map((b) => ({ ...b, avg: round1(mean(sums.get(b.key) ?? [])), n: (sums.get(b.key) ?? []).length })).filter((b) => b.n > 0);
}

/** DSH-05 heatmap: average mood per time block (rows) and weekday (columns). */
export function moodHeatmap(entries: InsightEntry[]) {
  const cells = new Map<string, number[]>();
  for (const e of active(entries)) {
    if (e.type !== "mood" || dataOf(e).scope === "day") continue;
    const p = localParts(e);
    const k = `${blockOf(p.hour).key}|${p.weekday}`;
    cells.set(k, [...(cells.get(k) ?? []), Number(dataOf(e).level)]);
  }
  return BLOCKS.slice(0, 5).map((b) => ({
    block: b.label,
    cells: [0, 1, 2, 3, 4, 5, 6].map((w) => ({ weekday: WEEKDAYS[w], avg: round1(mean(cells.get(`${b.key}|${w}`) ?? [])), n: (cells.get(`${b.key}|${w}`) ?? []).length })),
  }));
}

// ─── Tallies ─────────────────────────────────────────────────────────────────

export function tally(values: string[]): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function behaviorEvents(entries: InsightEntry[]) {
  return active(entries)
    .filter((e) => e.type === "mood")
    .flatMap((e) => ((dataOf(e).behaviors as { key: string; severity?: string }[] | undefined) ?? []).map((b) => ({ ...b, at: e.occurred_at, entry: e })));
}

/** DSH-06: top activities by count; enjoyment averages rated logs only. */
export function activityStats(entries: InsightEntry[]) {
  const by = new Map<string, { count: number; ratings: number[]; minutes: number }>();
  for (const e of active(entries)) {
    if (e.type !== "activity") continue;
    const d = dataOf(e);
    const k = String(d.activity_id);
    const s = by.get(k) ?? { count: 0, ratings: [], minutes: 0 };
    s.count += 1;
    if (typeof d.enjoyment === "number") s.ratings.push(d.enjoyment);
    if (typeof d.duration_min === "number") s.minutes += d.duration_min;
    by.set(k, s);
  }
  return [...by.entries()]
    .map(([key, s]) => ({ key, count: s.count, enjoyment: round1(mean(s.ratings)), rated: s.ratings.length, minutes: s.minutes }))
    .sort((a, b) => b.count - a.count);
}

export function weekKey(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return ymdLocal(d);
}

export function perWeek<T extends { day: string }>(rows: T[], value: (r: T) => number): { week: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(weekKey(r.day), (m.get(weekKey(r.day)) ?? 0) + value(r));
  return [...m.entries()].map(([week, value]) => ({ week, value }));
}

/** DSH-10: "down 40% vs previous 7 days", only when both periods have data. */
export function comparePeriods(current: number | null, previous: number | null): { pct: number; direction: "up" | "down" | "same" } | null {
  if (current === null || previous === null || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(pct), direction: pct > 2 ? "up" : pct < -2 ? "down" : "same" };
}
