// SET-01 display preferences. Set on the client by HouseholdProvider; times render from
// client-fetched data, so server output keeps the 12-hour default.

export interface DisplayPrefs {
  timeFormat: "12h" | "24h";
  weekStart: "sunday" | "monday";
}

let prefs: DisplayPrefs = { timeFormat: "12h", weekStart: "sunday" };

export function setDisplayPrefs(next: DisplayPrefs): void {
  if (typeof window !== "undefined") prefs = next;
}

export function displayPrefs(): DisplayPrefs {
  return prefs;
}

/** "6:45 PM" or "18:45". */
export function formatTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: prefs.timeFormat === "12h" });
}

/** "6 PM" or "18:00", for chart axes. */
export function formatHour(hour: number): string {
  const d = new Date(2000, 0, 1, Math.floor(hour), Math.round((hour % 1) * 60));
  return prefs.timeFormat === "12h"
    ? d.toLocaleTimeString("en-US", { hour: "numeric" })
    : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "Oct 26, 6:45 PM". */
export function formatDateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${formatTime(d)}`;
}

/** "Mon 6:45 PM". */
export function formatWeekdayTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${formatTime(d)}`;
}

/** Index of the first day of the week (0 = Sunday). */
export function weekStartIndex(): number {
  return prefs.weekStart === "monday" ? 1 : 0;
}
