// DSH-01 Today cards.
import type { CareStage } from "@/lib/supabase/types";
import { activityLabel, behaviorLabel, enjoymentLabel, formatVolume, labelFor, MEAL_TYPES, portionLabel, SEVERITIES } from "@/lib/options";
import { t } from "@/lib/i18n";
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
  const L = (k: string, v?: Record<string, string | number>) => t(`insights.today.${k}`, v);

  if (enabled.includes("bathroom")) {
    const lastBm = live.filter(isBm).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
    const days = lastBm ? Math.floor((now.getTime() - new Date(lastBm.occurred_at).getTime()) / 86_400_000) : null;
    const bmsToday = todays.filter(isBm).length;
    if (stage === "baby") {
      const wet = todays.filter(isWet).length;
      cards.push({
        module: "bathroom", label: opts.bathroomLabel, value: L("wet", { count: wet }), caption: L("dirtyToday", { count: bmsToday }),
        footnote: lastBm ? (days ? L("lastDirtyAgo", { time: clock(lastBm.occurred_at), days }) : L("lastDirty", { time: clock(lastBm.occurred_at) })) : L("noDirty"),
      });
    } else {
      const alert = bmAlertDays !== null && days !== null && days >= bmAlertDays;
      cards.push({
        module: "bathroom", label: opts.bathroomLabel,
        value: days === null ? "—" : days === 0 ? L("bmsToday", { count: bmsToday }) : L("days", { count: days }),
        caption: days === null ? L("noBms") : days === 0 ? L("today") : L("sinceLastBm"),
        footnote: alert ? L("atAlert", { days: bmAlertDays! }) : bmAlertDays ? L("alertAt", { days: bmAlertDays }) : undefined,
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
        module: "eating", label: t("modules.feeding"), value: L("feeds", { count: feeds.length }),
        caption: ml ? L("fromBottles", { amount: formatVolume(ml, volumeUnit) }) : L("breastfed"),
        footnote: L("lastAt", { time: clock(last.occurred_at) }),
      });
    } else if (eat.some((e) => dataOf(e).method === "tube") && !eat.some((e) => dataOf(e).method === "meal")) {
      const tube = eat.filter((e) => dataOf(e).method === "tube");
      const ml = tube.reduce((s, e) => s + (Number(dataOf(e).amount_ml) || 0), 0);
      cards.push({
        module: "eating", label: t("options.feedingPlural.tube"), value: L("tubeTotal", { amount: t("eating.ml", { n: ml }) }),
        caption: L("tubeFeeds", { count: tube.length }),
      });
    } else {
      const meals = eat.filter((e) => dataOf(e).method === "meal");
      const parts = MEAL_TYPES.map((m) => meals.find((e) => dataOf(e).meal_type === m.key))
        .filter((e): e is InsightEntry => !!e && dataOf(e).portion_pct !== undefined)
        .map((e) => L("portionAt", { portion: portionLabel(Number(dataOf(e).portion_pct)).toLowerCase(), meal: labelFor(MEAL_TYPES, String(dataOf(e).meal_type)).toLowerCase() }));
      const caption = parts.length ? parts.join(", ") : eat.length ? L("logged", { count: eat.length }) : L("nothingYet");
      cards.push({
        module: "eating", label: t(stage === "baby" ? "modules.feeding" : "modules.eating"), value: L("meals", { count: meals.length }),
        caption: caption.charAt(0).toUpperCase() + caption.slice(1),
      });
    }
  }

  if (enabled.includes("mood")) {
    const moods = todays.filter((e) => e.type === "mood" && dataOf(e).scope !== "day").sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const levels = moods.map((e) => Number(dataOf(e).level));
    const lowest = moods.reduce<InsightEntry | null>((lo, e) => (!lo || Number(dataOf(e).level) < Number(dataOf(lo).level) ? e : lo), null);
    cards.push({
      module: "mood", label: t("modules.mood"), value: levels.length ? L("moodAvg", { avg: round1(mean(levels))!.toFixed(1) }) : "—",
      caption: lowest && levels.length > 1 ? L("lowestAt", { time: clock(lowest.occurred_at) }) : levels.length ? L("moodLogs", { count: levels.length }) : L("noMoodToday"),
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
      module: "medication", label: t("modules.medication"), value: slots.length ? L("dosesOf", { given, total: slots.length }) : L("asNeededOnly"),
      caption: next
        ? L("next", { name: next.med.name.toLowerCase(), time: clock(next.slot.toISOString()) })
        : notLogged.length
          ? L("notLogged", { names: notLogged.map((s) => s.med.name).join(", ") })
          : slots.length ? L("allGiven") : L("noScheduled"),
      footnote: next && notLogged.length ? L("notLoggedCount", { count: notLogged.length }) : undefined,
      alert: notLogged.length > 0,
    });
  }

  if (enabled.includes("activity")) {
    const acts = todays.filter((e) => e.type === "activity");
    const minutes = acts.reduce((s, e) => s + (Number(dataOf(e).duration_min) || 0), 0);
    const top = [...acts].sort((a, b) => Number(dataOf(b).enjoyment ?? 0) - Number(dataOf(a).enjoyment ?? 0))[0];
    const name = top ? activityLabel(String(dataOf(top).activity_id)) : "";
    cards.push({
      module: "activity", label: t("modules.activity"), value: minutes ? L("minutes", { count: minutes }) : `${acts.length}`,
      caption: top
        ? dataOf(top).enjoyment ? L("withEnjoyment", { name, enjoyment: enjoymentLabel(Number(dataOf(top).enjoyment)).toLowerCase() }) : name
        : L("nothingToday"),
    });
  }

  if (enabled.includes("mood") && stage !== "baby") {
    const events = todays.flatMap((e) => ((dataOf(e).behaviors as { key: string; severity?: string }[] | undefined) ?? []).map((b) => ({ ...b, at: e.occurred_at })));
    const first = events[0];
    cards.push({
      module: "behaviors", label: L("behaviors"),
      value: events.length ? (events.length === 1 ? L("behaviorCount", { count: 1, name: behaviorLabel(first.key).toLowerCase() }) : L("behaviorsCount", { count: events.length })) : L("none"),
      caption: first ? (first.severity ? L("severityAt", { severity: labelFor(SEVERITIES, first.severity), time: clock(first.at) }) : clock(first.at)) : L("noBehaviors"),
    });
  }

  return cards;
}
