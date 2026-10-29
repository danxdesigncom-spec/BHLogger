// Pattern rules (PRD 8.9). Thresholds are constants so they can be tuned after the pilot.
import { t } from "@/lib/i18n";
import { BLOCKS, blockOf, dataOf, eachDay, isBm, localParts, mean, moodByBlock, moodDaily, round1, behaviorEvents, tally, ymdLocal, type InsightEntry } from "./core";

export const PATTERN_RULES = {
  PAT01_MIN_DAYS: 14,
  PAT01_MIN_LOGS: 30,
  PAT02_MIN_DAYS_EACH: 5,
  PAT02_MIN_GAP: 0.5,
  PAT03_WINDOW_DAYS: 14,
  PAT03_MIN_DAYS_EACH: 7,
  PAT04_AFTER_HOURS: 2,
  PAT04_MIN_TIMES: 5,
  PAT04_MIN_LIFT: 0.3,
  PAT05_MIN_WEEKS: 4,
  PAT05_MIN_GAP: 0.5,
  PAT06_LOW_MOOD: 2,
  PAT06_MIN_DAYS_EACH: 5,
  PAT06_MIN_GAP: 10,
  PAT07_MIN_DOSES: 5,
  WINDOW_DAYS: 30,
} as const;

/** DSH-13 caption, shown with every pattern card. */
export const notProof = () => t("insights.patterns.notProof");

export interface KeepLogging {
  status: "keep_logging";
  message: string;
  progress: number;
  goal: number;
}

const moodEntries = (es: InsightEntry[]) => es.filter((e) => e.type === "mood" && !e.deleted_at && Number(dataOf(e).level));

/** PAT-01: lowest average mood by 3-hour block. Needs 14 days and 30 mood logs. */
export function hardestTimeOfDay(entries: InsightEntry[]) {
  const moods = moodEntries(entries).filter((e) => dataOf(e).scope !== "day");
  const days = new Set(moods.map((e) => localParts(e).day)).size;
  if (days < PATTERN_RULES.PAT01_MIN_DAYS || moods.length < PATTERN_RULES.PAT01_MIN_LOGS) {
    return {
      status: "keep_logging" as const,
      message: t("insights.patterns.pat01Need", { days: PATTERN_RULES.PAT01_MIN_DAYS }),
      progress: Math.min(days, PATTERN_RULES.PAT01_MIN_DAYS),
      goal: PATTERN_RULES.PAT01_MIN_DAYS,
      logs: moods.length,
    };
  }
  const blocks = moodByBlock(moods);
  const hardest = [...blocks].sort((a, b) => (a.avg ?? 9) - (b.avg ?? 9))[0];
  return { status: "ready" as const, blocks, hardest, logs: moods.length, days };
}

/** PAT-02: average mood on days with no BM vs days with one. Shown when the gap is at least 0.5. */
export function moodAndBms(entries: InsightEntry[], from: Date, to: Date) {
  const days = eachDay(from, to);
  const mood = moodDaily(entries, days);
  const bmDays = new Set(entries.filter((e) => !e.deleted_at && isBm(e)).map((e) => localParts(e).day));
  const withBm = mood.filter((d) => d.avg !== null && bmDays.has(d.day)).map((d) => d.avg!);
  const without = mood.filter((d) => d.avg !== null && !bmDays.has(d.day)).map((d) => d.avg!);
  const min = PATTERN_RULES.PAT02_MIN_DAYS_EACH;
  if (withBm.length < min || without.length < min) {
    return { status: "keep_logging" as const, message: t("insights.patterns.pat02Need", { days: min }), progress: Math.min(withBm.length, without.length), goal: min };
  }
  const a = round1(mean(without))!;
  const b = round1(mean(withBm))!;
  if (Math.abs(a - b) < PATTERN_RULES.PAT02_MIN_GAP) return { status: "no_pattern" as const, without: a, with: b, daysWithout: without.length, daysWith: withBm.length };
  return { status: "ready" as const, without: a, with: b, daysWithout: without.length, daysWith: withBm.length };
}

export interface ChangeLike {
  medication_id: string;
  change_type: string;
  effective_at: string;
  before: unknown;
  after: unknown;
}

/** PAT-03: mood, BMs per day and behaviors, 14 days before vs 14 days after a medication change. */
export function beforeAfterChange(entries: InsightEntry[], change: ChangeLike, now: Date) {
  const W = PATTERN_RULES.PAT03_WINDOW_DAYS;
  const pivot = new Date(`${change.effective_at}T00:00:00`);
  const beforeFrom = new Date(pivot);
  beforeFrom.setDate(beforeFrom.getDate() - W);
  const beforeTo = new Date(pivot);
  beforeTo.setDate(beforeTo.getDate() - 1);
  const afterTo = new Date(pivot);
  afterTo.setDate(afterTo.getDate() + W - 1);
  const end = afterTo < now ? afterTo : now;

  const side = (from: Date, to: Date) => {
    const days = eachDay(from, to);
    const set = new Set(days);
    const mood = moodDaily(entries, days).filter((d) => d.avg !== null);
    const inRange = entries.filter((e) => !e.deleted_at && set.has(localParts(e).day));
    const bms = inRange.filter(isBm).length;
    const behaviors = behaviorEvents(inRange).length;
    return {
      days: mood.length,
      mood: round1(mean(mood.map((d) => d.avg!))),
      bmsPerDay: round1(bms / Math.max(1, days.length)),
      behaviors,
    };
  };
  const before = side(beforeFrom, beforeTo);
  const after = side(pivot, end);
  const min = PATTERN_RULES.PAT03_MIN_DAYS_EACH;
  if (before.days < min || after.days < min) {
    return { status: "keep_logging" as const, message: t("insights.patterns.pat03Need", { days: min }), progress: Math.min(before.days, after.days), goal: min, before, after };
  }
  return { status: "ready" as const, before, after, window: W, effective: change.effective_at };
}

/**
 * PAT-04: average mood logged in the 2 hours after an activity ends, against the overall average.
 * Each time the activity was logged counts once (its mood logs are averaged first). An activity needs
 * 5 such times; it's called out when it beats the overall average by PAT04_MIN_LIFT or more.
 */
export function activitiesThatLift(entries: InsightEntry[]) {
  const R = PATTERN_RULES;
  const moods = moodEntries(entries)
    .filter((e) => dataOf(e).scope !== "day")
    .map((e) => ({ at: new Date(e.occurred_at).getTime(), level: Number(dataOf(e).level) }));
  const overall = round1(mean(moods.map((m) => m.level)));
  const by = new Map<string, number[]>();
  for (const e of entries) {
    if (e.type !== "activity" || e.deleted_at) continue;
    const d = dataOf(e);
    const end = new Date(e.occurred_at).getTime() + (typeof d.duration_min === "number" ? d.duration_min : 0) * 60_000;
    const after = moods.filter((m) => m.at > end && m.at <= end + R.PAT04_AFTER_HOURS * 3_600_000).map((m) => m.level);
    if (!after.length) continue;
    const key = String(d.activity_id);
    by.set(key, [...(by.get(key) ?? []), mean(after)!]);
  }
  const stats = [...by.entries()].map(([key, xs]) => ({ key, times: xs.length, avg: round1(mean(xs))! }));
  const eligible = stats.filter((s) => s.times >= R.PAT04_MIN_TIMES);
  if (!eligible.length || overall === null) {
    return {
      status: "keep_logging" as const,
      message: t("insights.patterns.pat04Need", { times: R.PAT04_MIN_TIMES }),
      progress: Math.min(R.PAT04_MIN_TIMES, Math.max(0, ...stats.map((s) => s.times))),
      goal: R.PAT04_MIN_TIMES,
    };
  }
  const lifts = eligible.filter((s) => s.avg - overall >= R.PAT04_MIN_LIFT).sort((a, b) => b.avg - a.avg || b.times - a.times).slice(0, 3);
  const moodLogs = moods.length;
  if (!lifts.length) return { status: "no_pattern" as const, overall, checked: eligible.length, moodLogs };
  return { status: "ready" as const, overall, lifts, checked: eligible.length, moodLogs };
}

/**
 * PAT-05: average daily mood by weekday. Needs 4 weeks: every weekday has 4 days with mood logs.
 * The best and hardest days are called out when they're PAT05_MIN_GAP or more apart.
 */
export function weekdayMood(entries: InsightEntry[], from: Date, to: Date) {
  const R = PATTERN_RULES;
  const daily = moodDaily(entries, eachDay(from, to)).filter((d) => d.avg !== null);
  const byWeekday = [0, 1, 2, 3, 4, 5, 6].map((w) => daily.filter((d) => new Date(`${d.day}T00:00:00`).getDay() === w).map((d) => d.avg!));
  const weeks = Math.min(...byWeekday.map((xs) => xs.length));
  if (weeks < R.PAT05_MIN_WEEKS) {
    return { status: "keep_logging" as const, message: t("insights.patterns.pat05Need", { weeks: R.PAT05_MIN_WEEKS }), progress: weeks, goal: R.PAT05_MIN_WEEKS };
  }
  const weekdays = byWeekday.map((xs, weekday) => ({ weekday, avg: round1(mean(xs))!, days: xs.length }));
  const sorted = [...weekdays].sort((a, b) => a.avg - b.avg || a.weekday - b.weekday);
  const hardest = sorted[0];
  const best = sorted[sorted.length - 1];
  const result = { weekdays, hardest, best, days: daily.length };
  if (best.avg - hardest.avg < R.PAT05_MIN_GAP) return { status: "no_pattern" as const, ...result };
  return { status: "ready" as const, ...result };
}

/**
 * PAT-06: average portion eaten on low-mood days (daily mood PAT06_LOW_MOOD or lower) vs other days.
 * Needs 5 days in each group with both a mood log and a meal or snack portion.
 */
export function eatingAndMood(entries: InsightEntry[], from: Date, to: Date) {
  const R = PATTERN_RULES;
  const days = eachDay(from, to);
  const mood = new Map(moodDaily(entries, days).filter((d) => d.avg !== null).map((d) => [d.day, d.avg!]));
  const portions = new Map<string, number[]>();
  for (const e of entries) {
    const d = dataOf(e);
    if (e.type !== "eating" || e.deleted_at || !["meal", "snack"].includes(String(d.method)) || typeof d.portion_pct !== "number") continue;
    const day = localParts(e).day;
    portions.set(day, [...(portions.get(day) ?? []), d.portion_pct]);
  }
  const low: number[] = [];
  const other: number[] = [];
  for (const [day, ps] of portions) {
    const m = mood.get(day);
    if (m === undefined || !days.includes(day)) continue;
    (m <= R.PAT06_LOW_MOOD ? low : other).push(mean(ps)!);
  }
  const min = R.PAT06_MIN_DAYS_EACH;
  if (low.length < min || other.length < min) {
    return { status: "keep_logging" as const, message: t("insights.patterns.pat06Need", { days: min }), progress: Math.min(low.length, other.length), goal: min };
  }
  const result = { low: Math.round(mean(low)!), other: Math.round(mean(other)!), lowDays: low.length, otherDays: other.length };
  if (Math.abs(result.low - result.other) < R.PAT06_MIN_GAP) return { status: "no_pattern" as const, ...result };
  return { status: "ready" as const, ...result };
}

type Med = { id: string; name: string };
type BlockCount = { key: string; label: string; count: number };
export type PrnTiming =
  | { status: "keep_logging"; med: Med; message: string; progress: number; goal: number }
  | { status: "ready"; med: Med; doses: number; blocks: BlockCount[]; top: BlockCount; reason: { key: string; count: number } | null };

/** PAT-07: for each as-needed medication, the most common time block and reason. Needs 5 doses. */
export function prnTiming(entries: InsightEntry[], prnMeds: Med[]): PrnTiming[] {
  const R = PATTERN_RULES;
  const out: PrnTiming[] = [];
  for (const med of prnMeds) {
    const doses = entries.filter((e) => e.type === "medication" && !e.deleted_at && dataOf(e).medication_id === med.id && ["given", "partial"].includes(String(dataOf(e).outcome ?? "given")));
    if (!doses.length) continue;
    if (doses.length < R.PAT07_MIN_DOSES) {
      out.push({ status: "keep_logging", med, message: t("insights.patterns.pat07Need", { doses: R.PAT07_MIN_DOSES, name: med.name }), progress: doses.length, goal: R.PAT07_MIN_DOSES });
      continue;
    }
    const blockCounts = tally(doses.map((e) => blockOf(localParts(e).hour).key));
    const blocks = BLOCKS.map((b) => ({ key: b.key, label: b.label, count: blockCounts.find((c) => c.key === b.key)?.count ?? 0 }));
    // Ties go to the earlier block in the day.
    const top = blocks.reduce((best, b) => (b.count > best.count ? b : best), blocks[0]);
    const reasons = tally(doses.map((e) => String(dataOf(e).prn_reason ?? "")).filter(Boolean));
    out.push({ status: "ready", med, doses: doses.length, blocks, top, reason: reasons[0] ?? null });
  }
  return out;
}

/** The most recent dose or schedule change (or start) with an effective date in the past. */
export function latestChange<T extends ChangeLike>(changes: T[], now: Date): T | null {
  const today = ymdLocal(now);
  return [...changes].filter((c) => c.change_type !== "stopped" && c.effective_at <= today).sort((a, b) => b.effective_at.localeCompare(a.effective_at))[0] ?? null;
}
