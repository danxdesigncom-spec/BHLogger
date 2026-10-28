// RPT-02 flagged events: flagged entries, worrying stool colors or blood, food reactions,
// severe behaviors, refused or vomited doses, and app alerts reached (days without a BM).
import { behaviorLabel, formatDose, labelFor, REACTIONS, STOOL_COLORS } from "@/lib/options";
import { eachDay, isBm, localParts, type InsightEntry } from "@/lib/insights/core";
import { shortDate } from "@/lib/dates";
import { formatDateTime } from "@/lib/prefs";
import { t } from "@/lib/i18n";

const F = (k: string, v?: Record<string, string | number>) => t(`reports.flagged.${k}`, v);

export interface FlaggedEvent {
  when: string;
  sortKey: string;
  what: string;
  by: string;
}

type D = Record<string, unknown>;
const NOTICE_COLORS = new Set(["red", "black", "white_pale_clay"]);
const when = (iso: string) => formatDateTime(iso);

export function flaggedEvents(
  entries: (InsightEntry & { note?: string | null; logged_by_name: string })[],
  opts: { from: Date; to: Date; bmAlertDays: number | null; medName: (id: string) => string; describe: (e: InsightEntry) => string },
): FlaggedEvent[] {
  const out: FlaggedEvent[] = [];
  for (const e of entries) {
    if (e.deleted_at) continue;
    const d = (e.data ?? {}) as D;
    const reasons: string[] = [];
    if (e.type === "bathroom") {
      if (d.color && NOTICE_COLORS.has(String(d.color))) reasons.push(F("stool", { color: labelFor(STOOL_COLORS, String(d.color)).toLowerCase() }));
      if (Array.isArray(d.flags) && d.flags.includes("blood")) reasons.push(F("blood"));
    }
    if (e.type === "eating" && Array.isArray(d.reactions) && d.reactions.length) {
      reasons.push(F("reaction", { list: (d.reactions as string[]).map((r) => labelFor(REACTIONS, r).toLowerCase()).join(", ") }));
    }
    if (e.type === "mood") {
      for (const b of (d.behaviors as { key: string; severity?: string; duration_min?: number }[] | undefined) ?? []) {
        if (b.severity === "severe") {
          const name = behaviorLabel(b.key).toLowerCase();
          reasons.push(b.duration_min ? F("severeFor", { name, minutes: b.duration_min }) : F("severe", { name }));
        }
      }
    }
    if (e.type === "medication" && ["refused", "spit_up_vomited"].includes(String(d.outcome))) {
      reasons.push(F(d.outcome === "refused" ? "refused" : "vomited", { name: opts.medName(String(d.medication_id)), dose: formatDose(Number(d.dose), String(d.unit)) }));
    }
    if (!reasons.length && !e.flagged_for_doctor) continue;
    const base = reasons.length ? reasons.join("; ") : opts.describe(e);
    const what = `${base.charAt(0).toUpperCase()}${base.slice(1)}${e.note ? `. ${e.note}` : ""}`;
    out.push({ when: when(e.occurred_at), sortKey: e.occurred_at, what, by: e.logged_by_name });
  }

  // App alert: runs of days without a BM that reached the family's threshold.
  if (opts.bmAlertDays) {
    const bmDays = new Set(entries.filter((e) => !e.deleted_at && isBm(e)).map((e) => localParts(e).day));
    let run: string[] = [];
    const flush = () => {
      if (run.length >= opts.bmAlertDays!) {
        const a = new Date(`${run[0]}T00:00:00`);
        const b = new Date(`${run[run.length - 1]}T00:00:00`);
        out.push({
          when: run.length > 1 ? F("range", { from: shortDate(a), to: shortDate(b) }) : shortDate(a),
          sortKey: `${run[0]}T00:00:00`,
          what: F("noBm", { days: run.length }),
          by: F("appAlert"),
        });
      }
      run = [];
    };
    for (const day of eachDay(opts.from, opts.to)) {
      if (bmDays.has(day)) flush();
      else run.push(day);
    }
    flush();
  }

  return out.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
