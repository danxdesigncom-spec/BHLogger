import { t } from "@/lib/i18n";
import { dateLocale } from "@/lib/prefs";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Local calendar date as YYYY-MM-DD. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fromYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Today · Mon, Oct 26", "Yesterday · Sun, Oct 25", "Sat, Oct 24". */
export function dayHeading(day: Date, now = new Date()): string {
  const date = day.toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric" });
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(day).getTime()) / 86_400_000);
  if (diff === 0) return t("common.dayHeadingToday", { date });
  if (diff === 1) return t("common.dayHeadingYesterday", { date });
  return date;
}

export function shortDate(d: Date): string {
  return d.toLocaleDateString(dateLocale(), { month: "short", day: "numeric" });
}

/** "Oct 26, 2026". */
export function longDate(d: Date): string {
  return d.toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" });
}
