// RPT-04: one row per entry with UTC and local timestamps, profile, module, logged-by and flattened fields.

export interface CsvEntry {
  id: string;
  type: string;
  occurred_at: string;
  tz: string;
  data: unknown;
  note: string | null;
  flagged_for_doctor: boolean;
  logged_by_name: string;
  profile_id: string;
}

const BASE = ["entry_id", "profile", "module", "occurred_at_utc", "occurred_at_local", "time_zone", "logged_by", "flagged_for_doctor", "note"];

function flatten(value: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    out[prefix] = value.map((v) => (v && typeof v === "object" ? Object.values(v).join(" ") : String(v))).join("; ");
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = String(value);
  }
  return out;
}

/** Quote a cell, and neutralize spreadsheet formulas (CSV injection) by prefixing an apostrophe. */
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function localTimestamp(iso: string, tz: string): string {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date(iso))
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  } catch {
    return iso;
  }
}

export function entriesToCsv(entries: CsvEntry[], profileName: (id: string) => string): string {
  const rows = entries.map((e) => ({
    base: [e.id, profileName(e.profile_id), e.type, e.occurred_at, localTimestamp(e.occurred_at, e.tz), e.tz, e.logged_by_name, e.flagged_for_doctor ? "yes" : "no", e.note ?? ""],
    data: flatten(e.data),
  }));
  const dataKeys = [...new Set(rows.flatMap((r) => Object.keys(r.data)))].sort();
  const header = [...BASE, ...dataKeys];
  const lines = [header.join(",")];
  for (const r of rows) lines.push([...r.base, ...dataKeys.map((k) => r.data[k] ?? "")].map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8"): void {
  const blob = new Blob(["﻿" + text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
