// DSH-12 (P1): "Add to report" collects pattern cards for the next report preview, on this device.

export interface ReportItem {
  id: string;
  title: string;
  detail: string;
}

const KEY = "bl-report-items";

export function reportItems(): ReportItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function hasReportItem(id: string): boolean {
  return typeof window !== "undefined" && reportItems().some((i) => i.id === id);
}

export function addReportItem(item: ReportItem): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...reportItems().filter((i) => i.id !== item.id), item]));
  } catch {
    /* storage unavailable */
  }
}

export function removeReportItem(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(reportItems().filter((i) => i.id !== id)));
  } catch {
    /* storage unavailable */
  }
}
