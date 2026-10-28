import type { CareStage } from "@/lib/supabase/types";
import { startOfDay } from "@/lib/dates";
import { slotsForDay, slotStatus, type MedLike } from "@/lib/meds/schedule";
import { consistencyLabel } from "@/lib/entries/summary";
import { behaviorLabel, feelingLabel, humanize, labelFor, moodLabels, portionLabel, STOOL_COLORS } from "@/lib/options";
import { formatWeekdayTime } from "@/lib/prefs";
import { has, t } from "@/lib/i18n";

interface E {
  id: string;
  type: string;
  occurred_at: string;
  data: unknown;
}

export function groupByDay<T extends E>(entries: T[]): { day: Date; entries: T[] }[] {
  const groups = new Map<number, T[]>();
  for (const e of entries) {
    const key = startOfDay(new Date(e.occurred_at)).getTime();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([key, list]) => ({ day: new Date(key), entries: list.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)) }));
}

/** TL-04: "1 BM · 3 meals · mood 3.2 average · meds 2 of 3". */
export function daySummary(entries: E[], day: Date, meds: MedLike[], stage: CareStage, now = new Date()): string {
  const d = (e: E) => (e.data ?? {}) as Record<string, unknown>;
  const parts: string[] = [];

  const bms = entries.filter((e) => e.type === "bathroom" && ["bm", "both"].includes(String(d(e).kind))).length;
  if (bms) parts.push(t("timeline.summary.bms", { count: bms }));

  const feeds = entries.filter((e) => e.type === "eating" && ["breast", "bottle"].includes(String(d(e).method))).length;
  const meals = entries.filter((e) => e.type === "eating" && d(e).method === "meal").length;
  if (stage === "baby" && feeds) parts.push(t("timeline.summary.feeds", { count: feeds }));
  if (meals) parts.push(t("timeline.summary.meals", { count: meals }));

  const dayMood = entries.find((e) => e.type === "mood" && d(e).scope === "day");
  const moods = entries.filter((e) => e.type === "mood" && d(e).scope !== "day").map((e) => Number(d(e).level)).filter(Boolean);
  if (dayMood) parts.push(t("timeline.summary.dayRated", { level: Number(d(dayMood).level) }));
  else if (moods.length) parts.push(t("timeline.summary.moodAverage", { avg: (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) }));

  const doses = entries.filter((e) => e.type === "medication") as (E & { logged_by_name: string })[];
  let scheduled = 0;
  let given = 0;
  for (const med of meds) {
    for (const slot of slotsForDay(med, day)) {
      const s = slotStatus(med, slot, doses as never, now);
      scheduled += 1;
      if (s.state === "given") given += 1;
    }
  }
  if (scheduled) parts.push(t("timeline.summary.meds", { given, scheduled }));

  return parts.join(" · ");
}

function show(key: string, v: unknown, stage: CareStage): string {
  if (v === null || v === undefined || (Array.isArray(v) && !v.length)) return t("timeline.revision.none");
  if (key === "level") return moodLabels(stage)[Number(v) - 1]?.toLowerCase() ?? String(v);
  if (key === "consistency") return consistencyLabel(v)?.toLowerCase() ?? String(v);
  if (key === "color") return labelFor(STOOL_COLORS, String(v)).toLowerCase();
  if (key === "portion_pct") return portionLabel(Number(v)).toLowerCase();
  if (key === "feelings") return (v as string[]).map(feelingLabel).join(", ").toLowerCase();
  if (key === "behaviors") {
    return (v as { key: string; severity?: string }[]).map((b) => (b.severity ? b.severity : behaviorLabel(b.key).toLowerCase())).join(", ");
  }
  if (Array.isArray(v)) return v.map((x) => humanize(String(x)).toLowerCase()).join(", ");
  return humanize(String(v)).toLowerCase();
}

/** TL-05: "changed intensity from mild to moderate", "moved it to Maya", "changed the time to 5:30 PM". */
export function describeRevision(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  stage: CareStage,
  profileName: (id: string) => string,
): string[] {
  const out: string[] = [];
  if (before.deleted_at !== after.deleted_at) out.push(t(after.deleted_at ? "timeline.revision.deleted" : "timeline.revision.restored"));
  if (before.profile_id !== after.profile_id) out.push(t("timeline.revision.moved", { name: profileName(String(after.profile_id)) }));
  if (before.occurred_at !== after.occurred_at) out.push(t("timeline.revision.time", { time: formatWeekdayTime(String(after.occurred_at)) }));
  if (before.flagged_for_doctor !== after.flagged_for_doctor) out.push(t(after.flagged_for_doctor ? "timeline.revision.flagged" : "timeline.revision.unflagged"));
  if ((before.note ?? null) !== (after.note ?? null)) out.push(t(after.note ? "timeline.revision.noteEdited" : "timeline.revision.noteRemoved"));
  const bd = (before.data ?? {}) as Record<string, unknown>;
  const ad = (after.data ?? {}) as Record<string, unknown>;
  for (const key of new Set([...Object.keys(bd), ...Object.keys(ad)])) {
    if (JSON.stringify(bd[key] ?? null) === JSON.stringify(ad[key] ?? null)) continue;
    const field = has(`timeline.revision.field.${key}`) ? t(`timeline.revision.field.${key}`) : humanize(key).toLowerCase();
    out.push(t("timeline.revision.changed", { field, from: show(key, bd[key], stage), to: show(key, ad[key], stage) }));
  }
  return out;
}

/** Caregiver label on timeline rows: short display name, initials when longer than 8 characters. */
export function caregiverLabel(name: string, initials: string): string {
  return name.length > 8 ? initials : name;
}
