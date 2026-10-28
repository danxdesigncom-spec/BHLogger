// Pattern rules (PRD 8.9). Thresholds are constants so they can be tuned after the pilot.
import { t } from "@/lib/i18n";
import { dataOf, eachDay, isBm, localParts, mean, moodByBlock, moodDaily, round1, behaviorEvents, ymdLocal, type InsightEntry } from "./core";

export const PATTERN_RULES = {
  PAT01_MIN_DAYS: 14,
  PAT01_MIN_LOGS: 30,
  PAT02_MIN_DAYS_EACH: 5,
  PAT02_MIN_GAP: 0.5,
  PAT03_WINDOW_DAYS: 14,
  PAT03_MIN_DAYS_EACH: 7,
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

/** The most recent dose or schedule change (or start) with an effective date in the past. */
export function latestChange<T extends ChangeLike>(changes: T[], now: Date): T | null {
  const today = ymdLocal(now);
  return [...changes].filter((c) => c.change_type !== "stopped" && c.effective_at <= today).sort((a, b) => b.effective_at.localeCompare(a.effective_at))[0] ?? null;
}
