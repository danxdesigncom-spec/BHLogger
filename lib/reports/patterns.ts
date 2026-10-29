// S17 "Patterns the app noticed": one line per pattern that met its threshold in the report's range
// (PAT-01 to PAT-07). Ids match the Patterns screen, so items added there (DSH-12) can be matched.
import type { InsightEntry } from "@/lib/insights/core";
import {
  activitiesThatLift, beforeAfterChange, eatingAndMood, hardestTimeOfDay, latestChange, moodAndBms, prnTiming, weekdayMood,
  type ChangeLike,
} from "@/lib/insights/patterns";
import { labelFor, PRN_REASONS } from "@/lib/options";
import { fromYmd, shortDate, weekdayName } from "@/lib/dates";
import { t } from "@/lib/i18n";

export interface ReportPatternInput {
  inRange: InsightEntry[];
  /** Entries from before the range too, for PAT-03's 14 days before a change. */
  all: InsightEntry[];
  from: Date;
  to: Date;
  fromYmd: string;
  name: string;
  changes: ChangeLike[];
  prnMeds: { id: string; name: string }[];
  medName: (id: string) => string;
  activityName: (key: string) => string;
}

export const patternIds = {
  pat03: (c: { medication_id: string; effective_at: string }) => `pat03:${c.medication_id}:${c.effective_at}`,
  pat07: (medId: string) => `pat07:${medId}`,
};

const T = (k: string, v?: Record<string, string | number>) => t(`reports.doc.${k}`, v);

export function reportPatterns(x: ReportPatternInput): { id: string; line: string }[] {
  const out: { id: string; line: string }[] = [];
  const last30 = x.inRange.filter((e) => new Date(e.occurred_at) >= new Date(x.to.getTime() - 30 * 86_400_000));

  const change = latestChange(x.changes.filter((c) => c.change_type !== "started" || c.effective_at >= x.fromYmd), x.to);
  const pat03 = change ? beforeAfterChange(x.all, change, x.to) : null;
  if (change && pat03?.status === "ready") {
    out.push({
      id: patternIds.pat03(change),
      line: T("patChange", { after: pat03.after.mood?.toFixed(1) ?? "", name: x.medName(change.medication_id).toLowerCase(), date: shortDate(fromYmd(change.effective_at)), before: pat03.before.mood?.toFixed(1) ?? "", days: pat03.window }),
    });
  }

  const pat01 = hardestTimeOfDay(last30);
  if (pat01.status === "ready") {
    const others = pat01.blocks.filter((b) => b.key !== pat01.hardest.key && b.avg !== null);
    const avgOthers = others.reduce((s, b) => s + (b.avg ?? 0), 0) / Math.max(1, others.length);
    out.push({ id: "pat01", line: T("patTime", { block: pat01.hardest.label, avg: pat01.hardest.avg?.toFixed(1) ?? "", others: avgOthers.toFixed(1) }) });
  }

  const pat02 = moodAndBms(x.inRange, x.from, x.to);
  if (pat02.status === "ready") out.push({ id: "pat02", line: T("patBm", { without: pat02.without.toFixed(1), with: pat02.with.toFixed(1) }) });

  const pat04 = activitiesThatLift(x.inRange);
  if (pat04.status === "ready") {
    const top = pat04.lifts[0];
    out.push({ id: "pat04", line: T("patActivity", { activity: x.activityName(top.key).toLowerCase(), avg: top.avg.toFixed(1), overall: pat04.overall.toFixed(1), times: top.times }) });
  }

  const pat05 = weekdayMood(x.inRange, x.from, x.to);
  if (pat05.status === "ready") {
    out.push({ id: "pat05", line: T("patWeekday", { hardest: weekdayName(pat05.hardest.weekday), hardestAvg: pat05.hardest.avg.toFixed(1), best: weekdayName(pat05.best.weekday), bestAvg: pat05.best.avg.toFixed(1) }) });
  }

  const pat06 = eatingAndMood(x.inRange, x.from, x.to);
  if (pat06.status === "ready") out.push({ id: "pat06", line: T("patEating", { name: x.name, low: pat06.low, other: pat06.other }) });

  for (const p of prnTiming(x.inRange, x.prnMeds)) {
    if (p.status !== "ready") continue;
    out.push({
      id: patternIds.pat07(p.med.id),
      line: p.reason
        ? T("patPrnReason", { name: p.med.name, block: p.top.label, count: p.top.count, doses: p.doses, reason: labelFor(PRN_REASONS, p.reason.key).toLowerCase() })
        : T("patPrn", { name: p.med.name, block: p.top.label, count: p.top.count, doses: p.doses }),
    });
  }
  return out;
}
