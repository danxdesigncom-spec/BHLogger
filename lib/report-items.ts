// DSH-12 (P1): "Add to report" on any chart or pattern card collects it for the profile's next report
// preview, on this device. Charts print for the report's own date range; patterns print when they meet
// their thresholds in that range.

export interface ReportItem {
  /** "chart:<card id>" or "pattern:<pattern id>". */
  id: string;
  profileId: string;
  kind: "chart" | "pattern";
  title: string;
  detail: string;
}

const KEY = "bl-report-items";

function readAll(): ReportItem[] {
  try {
    const xs = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // Items saved before items were kept per profile have no profileId and are dropped.
    return Array.isArray(xs) ? xs.filter((i) => i && typeof i.profileId === "string" && typeof i.id === "string") : [];
  } catch {
    return [];
  }
}

function writeAll(items: ReportItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable */
  }
}

export const chartItemId = (cardId: string) => `chart:${cardId}`;
export const patternItemId = (patternId: string) => `pattern:${patternId}`;

export function reportItems(profileId: string): ReportItem[] {
  return readAll().filter((i) => i.profileId === profileId);
}

export function hasReportItem(profileId: string, id: string): boolean {
  return typeof window !== "undefined" && reportItems(profileId).some((i) => i.id === id);
}

export function addReportItem(item: ReportItem): void {
  writeAll([...readAll().filter((i) => !(i.profileId === item.profileId && i.id === item.id)), item]);
}

export function removeReportItem(profileId: string, id: string): void {
  writeAll(readAll().filter((i) => !(i.profileId === profileId && i.id === id)));
}
