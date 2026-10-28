// DSH-01 Today cards.
import type { CareStage } from "@/lib/supabase/types";
import { activityLabel, behaviorLabel, ENJOYMENT_LABELS, formatVolume, humanize, MEAL_TYPES, portionLabel } from "@/lib/options";
import { slotsForDay, slotStatus, type MedLike } from "@/lib/meds/schedule";
import { dataOf, isBm, isWet, localParts, mean, round1, ymdLocal, type InsightEntry } from "./core";
import { formatTime } from "@/lib/prefs";

export interface TodayCard {
  module: "bathroom" | "eating" | "mood" | "medication" | "activity" | "behaviors";
  label: string;
  value: string;
  caption: string;
  footnote?: string;
  alert?: boolean;
  sparkline?: number[];
}

const clock = (iso: string) => formatTime(iso);

export function todayCards(opts: {
  entries: InsightEntry[];
  meds: (MedLike & { default_dose: number; dose_unit: string })[];
  stage: CareStage;
  enabled: string[];
  bmAlertDays: number | null;
  volumeUnit: "ml" | "oz";
  bathroomLabel: string;
  now: Date;
}): TodayCard[] {
  const { entries, meds, stage, enabled, bmAlertDays, volumeUnit, now } = opts;
  const today = ymdLocal(now);
  const live = entries.filter((e) => !e.deleted_at);
  const todays = live.filter((e) => localParts(e).day === today);
  const cards: TodayCard[] = [];

  if (enabled.includes("bathroom")) {
    const lastBm = live.filter(isBm).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
    const days = lastBm ? Math.floor((now.getTime() - new Date(lastBm.occurred_at).getTime()) / 86_400_000) : null;
    const bmsToday = todays.filter(isBm).length;
    if (stage === "baby") {
      const wet = todays.filter(isWet).length;
      cards.push({
        module: "bathroom", label: opts.bathroomLabel, value: `${wet} wet`, caption: `${bmsToday} dirty today`,
        footnote: lastBm ? `Last dirty ${clock(lastBm.occurred_at)}${days ? `, ${days} d ago` : ""}` : "No dirty diapers logged",
      });
    } else {
      const alert = bmAlertDays !== null && days !== null && days >= bmAlertDays;
      cards.push({
        module: "bathroom", label: opts.bathroomLabel,
        value: days === null ? "—" : days === 0 ? `${bmsToday} BM${bmsToday === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"}`,
        caption: days === null ? "No BMs logged yet" : days === 0 ? "today" : "since last BM",
        footnote: alert ? `At your ${bmAlertDays}-day alert` : bmAlertDays ? `Alert at ${bmAlertDays} days` : undefined,
        alert,
      });
    }
  }

  if (enabled.includes("eating")) {
    const eat = todays.filter((e) => e.type === "eating");
    const feeds = eat.filter((e) => ["breast", "bottle"].includes(String(dataOf(e).method)));
    if (stage === "baby" && feeds.length) {
      const ml = feeds.reduce((s, e) => s + (Number(dataOf(e).amount_ml) || 0), 0);
      const last = feeds.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
      cards.push({
        module: "eating", label: "Feeding", value: `${feeds.length} feeds`,
        caption: ml ? `${formatVolume(ml, volumeUnit)} from bottles` : "Breastfed",
        footnote: `Last ${clock(last.occurred_at)}`,
      });
    } else {
      const meals = eat.filter((e) => dataOf(e).method === "meal");
      const parts = MEAL_TYPES.map((m) => meals.find((e) => dataOf(e).meal_type === m.key))
        .filter((e): e is InsightEntry => !!e && dataOf(e).portion_pct !== undefined)
        .map((e) => `${portionLabel(Number(dataOf(e).portion_pct)).toLowerCase()} at ${String(dataOf(e).meal_type)}`);
      cards.push({
        module: "eating", label: stage === "baby" ? "Feeding" : "Eating", value: `${meals.length} meal${meals.length === 1 ? "" : "s"}`,
        caption: parts.length ? humanize(parts.join(", ")) : eat.length ? `${eat.length} logged` : "Nothing logged yet",
      });
    }
  }

  if (enabled.includes("mood")) {
    const moods = todays.filter((e) => e.type === "mood" && dataOf(e).scope !== "day").sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const levels = moods.map((e) => Number(dataOf(e).level));
    const lowest = moods.reduce<InsightEntry | null>((lo, e) => (!lo || Number(dataOf(e).level) < Number(dataOf(lo).level) ? e : lo), null);
    cards.push({
      module: "mood", label: "Mood", value: levels.length ? `${round1(mean(levels))!.toFixed(1)} avg` : "—",
      caption: lowest && levels.length > 1 ? `Lowest at ${clock(lowest.occurred_at)}` : levels.length ? `${levels.length} log` : "No mood logged today",
      sparkline: levels,
    });
  }

  if (enabled.includes("medication")) {
    const doses = live.filter((e) => e.type === "medication") as never[];
    const slots = meds.filter((m) => m.active && m.kind === "scheduled").flatMap((m) => slotsForDay(m, now).map((s) => ({ med: m, ...slotStatus(m, s, doses, now) })));
    const given = slots.filter((s) => s.state === "given").length;
    const next = slots.filter((s) => s.state === "due" || s.state === "upcoming").sort((a, b) => a.slot.getTime() - b.slot.getTime())[0];
    const notLogged = slots.filter((s) => s.state === "not_logged");
    cards.push({
      module: "medication", label: "Medication", value: slots.length ? `${given} of ${slots.length}` : "As needed",
      caption: next
        ? `Next: ${next.med.name.toLowerCase()} at ${clock(next.slot.toISOString())}`
        : notLogged.length
          ? `${notLogged.map((s) => s.med.name).join(", ")} not logged`
          : slots.length ? "All scheduled doses given" : "No scheduled doses",
      footnote: next && notLogged.length ? `${notLogged.length} not logged` : undefined,
      alert: notLogged.length > 0,
    });
  }

  if (enabled.includes("activity")) {
    const acts = todays.filter((e) => e.type === "activity");
    const minutes = acts.reduce((s, e) => s + (Number(dataOf(e).duration_min) || 0), 0);
    const top = [...acts].sort((a, b) => Number(dataOf(b).enjoyment ?? 0) - Number(dataOf(a).enjoyment ?? 0))[0];
    cards.push({
      module: "activity", label: "Activity", value: minutes ? `${minutes} min` : `${acts.length}`,
      caption: top
        ? `${activityLabel(String(dataOf(top).activity_id))}${dataOf(top).enjoyment ? `, ${ENJOYMENT_LABELS[Number(dataOf(top).enjoyment) - 1].toLowerCase()}` : ""}`
        : "Nothing logged today",
    });
  }

  if (enabled.includes("mood") && stage !== "baby") {
    const events = todays.flatMap((e) => ((dataOf(e).behaviors as { key: string; severity?: string }[] | undefined) ?? []).map((b) => ({ ...b, at: e.occurred_at })));
    const first = events[0];
    cards.push({
      module: "behaviors", label: "Behaviors",
      value: events.length ? `${events.length} ${events.length === 1 ? behaviorLabel(first.key).toLowerCase() : "behaviors"}` : "None",
      caption: first ? `${first.severity ? humanize(first.severity) + " · " : ""}${clock(first.at)}` : "No notable behaviors today",
    });
  }

  return cards;
}
