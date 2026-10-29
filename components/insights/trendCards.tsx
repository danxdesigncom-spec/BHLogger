"use client";

// Every Trends chart (S13, DSH-03 to DSH-09) as a card spec. Trends renders them as ChartCards; the
// report (S16/S17) renders the ones added with "Add to report" (DSH-12) for its own date range.
import type { ReactNode } from "react";
import { DailyBars, DoseTimes, FoodSplit, LabeledBars, MoodHeatmap, MoodLine, NewFoodStrip, TopBars, type Marker } from "./charts";
import type { TableData } from "./ChartCard";
import { MODULE_ICONS } from "@/components/log/LogSheet";
import type { InsightEntry } from "@/lib/insights/core";
import { FOOD_RULES, foodIntroductions, foodStats, rankFoods } from "@/lib/insights/foods";
import { activityTrend, bathroomTrend, behaviorTrend, eatingTrend, medsTrend, moodTrend } from "@/lib/insights/trends";
import type { MedicationRow } from "@/lib/data/types";
import { bathroomTileLabel, labelFor, REACTIONS } from "@/lib/options";
import type { CareStage, Toileting } from "@/lib/supabase/types";
import { shortDate } from "@/lib/dates";
import { t } from "@/lib/i18n";

export type TrendModule = "mood" | "bathroom" | "behaviors" | "eating" | "activity" | "medication";

export interface TrendCard {
  id: string;
  module: TrendModule;
  kicker: string;
  icon: ReactNode;
  inkClass: string;
  headline: string;
  caption?: string;
  table?: TableData;
  /** Time series that carry medication-change markers (DSH-08). */
  markers?: boolean;
  chart: (print?: boolean) => ReactNode;
}

export interface TrendInput {
  inRange: InsightEntry[];
  previous: InsightEntry[];
  days: string[];
  from: Date;
  to: Date;
  markers: Marker[];
  meds: MedicationRow[];
  stage: CareStage;
  toileting: Toileting;
  bmAlertDays: number | null;
  volumeUnit: "ml" | "oz";
  foodLabel: (key: string) => string;
  now: Date;
}

const T = (k: string, v?: Record<string, string | number>) => t(`insights.trends.${k}`, v);
const d8 = (day: string) => shortDate(new Date(`${day}T00:00:00`));
const hhmm = (hour: number) => `${Math.floor(hour)}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;

export function buildTrendCards(x: TrendInput): TrendCard[] {
  const { inRange, previous, days, markers, stage, toileting } = x;
  const mood = moodTrend(inRange, previous, days, markers, stage);
  const bath = bathroomTrend(inRange, previous, days, x.from, x.to, stage, toileting, x.bmAlertDays);
  const beh = behaviorTrend(inRange, previous, days, markers);
  const eat = eatingTrend(inRange, days, x.volumeUnit);
  const act = activityTrend(inRange, days);
  const meds = medsTrend(inRange, days, x.from, x.to, x.meds.map((m) => ({ ...m })), x.now);
  const foods = rankFoods(foodStats(inRange));
  const intros = foodIntroductions(inRange);
  const foodList = (keys: string[]) => keys.map(x.foodLabel).join(", ");

  const moodCard = { module: "mood" as const, icon: MODULE_ICONS.mood, inkClass: "text-mood-ink" };
  const bathCard = { module: "bathroom" as const, icon: MODULE_ICONS.bathroom, inkClass: "text-bathroom-ink" };
  const eatCard = { module: "eating" as const, icon: MODULE_ICONS.eating, inkClass: "text-eating-ink" };
  const actCard = { module: "activity" as const, icon: MODULE_ICONS.activity, inkClass: "text-activity-ink" };
  const medCard = { module: "medication" as const, icon: MODULE_ICONS.medication, inkClass: "text-medication-ink" };
  const bathLabel = bathroomTileLabel(stage, toileting);
  const empty = (text: string) => <p className="text-body text-muted-foreground">{text}</p>;

  const cards: (TrendCard | false)[] = [
    {
      ...moodCard, id: "mood.daily", kicker: t("modules.mood"), headline: mood.headline, caption: mood.caption, table: mood.table, markers: true,
      chart: (print) => <MoodLine data={mood.daily} markers={markers} averages={mood.averages} height={print ? 200 : undefined} />,
    },
    mood.logCount > 0 && {
      ...moodCard, id: "mood.heatmap", kicker: T("timeOfDayKicker"), headline: T("timeOfDayHeadline"), caption: T("timeOfDayCaption"),
      chart: () => <MoodHeatmap rows={mood.heatmap} />,
    },
    mood.feelings.length > 0 && {
      ...moodCard, id: "mood.feelings", kicker: T("feelings"), headline: T("mostFeeling", { name: mood.feelings[0].label }),
      caption: T("feelingsCaption", { count: mood.logCount }),
      table: { columns: [T("feeling"), T("times")], rows: mood.feelings.map((f) => [f.label, f.value]) },
      chart: () => <TopBars data={mood.feelings} color="var(--chart-2)" />,
    },

    {
      ...bathCard, id: "bathroom.bms", kicker: bathLabel, headline: bath.headline, caption: bath.caption, table: bath.table, markers: true,
      chart: (print) => <DailyBars data={bath.series} color="var(--chart-1)" bands={bath.bands} markers={markers} average unit={(v) => T("bmUnit", { count: v })} height={print ? 170 : undefined} />,
    },
    !!bath.wet && bath.wet.some((w) => w.count) && {
      ...bathCard, id: "bathroom.wet", kicker: T("wetDiapers"),
      headline: T("wetHeadline", { count: Math.round(bath.wet.reduce((s, w) => s + w.count, 0) / bath.wet.length) }),
      table: { columns: [T("day"), T("wet")], rows: bath.wet.map((w) => [d8(w.day), w.count]) },
      chart: () => <DailyBars data={bath.wet!.map((w) => ({ day: w.day, value: w.count }))} color="var(--chart-1)" unit={(v) => T("wetUnit", { count: v })} />,
    },
    !!bath.training && {
      ...bathCard, id: "bathroom.training", kicker: T("potty"),
      headline: T("pottyHeadline", { toilet: bath.training.reduce((s, d) => s + d.toilet, 0), accident: bath.training.reduce((s, d) => s + d.accident, 0) }),
      table: { columns: [T("day"), T("toilet"), T("accident")], rows: bath.training.map((d) => [d8(d.day), d.toilet, d.accident]) },
      chart: () => <DailyBars data={bath.training!.map((d) => ({ day: d.day, value: d.accident }))} color="var(--chart-highlight)" unit={(v) => T("accidentsUnit", { count: v })} />,
    },
    bath.consistency.length > 0 && {
      ...bathCard, id: "bathroom.consistency", kicker: T("consistency"), headline: T("mostOften", { name: bath.consistency[0].label.toLowerCase() }),
      table: { columns: [T("consistency"), T("bms")], rows: bath.consistency.map((c) => [c.label, c.value]) },
      chart: () => <TopBars data={bath.consistency} color="var(--chart-1)" />,
    },

    {
      module: "behaviors", icon: MODULE_ICONS.mood, inkClass: "text-behavior-ink",
      id: "behaviors.daily", kicker: T("behaviors"), headline: beh.headline, caption: beh.caption, table: beh.table, markers: true,
      chart: () => <DailyBars data={beh.series} color="var(--chart-highlight)" markers={markers} unit={(v) => T("behaviorUnit", { count: v })} />,
    },

    eat.hasFeeds && {
      ...eatCard, id: "eating.feeds", kicker: T("feeds"), headline: eat.feedsHeadline,
      table: { columns: [T("day"), T("feeds"), T("bottleCol", { unit: x.volumeUnit })], rows: eat.feeds.map((f, i) => [d8(f.day), f.value, eat.volume[i].value]) },
      chart: () => <DailyBars data={eat.feeds} color="var(--chart-5)" unit={(v) => T("feedsUnit", { count: v })} />,
    },
    eat.portions.length > 0 && {
      ...eatCard, id: "eating.portions", kicker: T("meals"), headline: eat.portionsHeadline, caption: T("averageByMeal"), table: eat.table,
      chart: () => <LabeledBars data={eat.portions} highlight={[...eat.portions].sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0]?.label} domain={[0, 100]} format={(v) => T("pctValue", { value: v })} />,
    },
    foods.ranked.length > 0 && {
      ...eatCard, id: "eating.foods", kicker: T("foods"),
      headline: foodsHeadline(foods, x.foodLabel),
      caption: T("foodsCaption", { min: FOOD_RULES.MIN_LOGS }),
      table: {
        columns: [T("food"), T("logs"), T("ateCol"), T("refusedCol")],
        rows: foods.ranked.map((f) => [x.foodLabel(f.key), f.logs, f.accepted, f.refused]),
      },
      chart: () => <FoodSplit rows={foods.rows.map((f) => ({ label: x.foodLabel(f.key), logs: f.logs, accepted: f.accepted, refused: f.refused }))} hidden={foods.hidden} />,
    },
    intros.length > 0 && {
      ...eatCard, id: "eating.newFoods", kicker: T("newFoods"),
      headline: T("newFoodsHeadline", { count: intros.reduce((s, i) => s + Math.max(1, i.foods.length), 0), days: days.length }),
      caption: T("newFoodsCaption"),
      table: {
        columns: [T("day"), T("food"), T("howItWent")],
        rows: intros.map((i) => [d8(i.day), foodList(i.foods) || T("unnamedFood"), introNote(i.outcome, i.reactions)]),
      },
      chart: () => <NewFoodStrip days={days} items={intros.map((i) => ({ day: i.day, label: foodList(i.foods) || T("unnamedFood"), note: `${d8(i.day)} · ${introNote(i.outcome, i.reactions)}` }))} />,
    },
    eat.hasTube && {
      ...eatCard, id: "eating.tube", kicker: T("tube"), headline: eat.tubeHeadline, caption: T("tubeCaption"), table: eat.tubeTable,
      chart: () => <DailyBars data={eat.tube} color="var(--chart-5)" unit={(v) => t("eating.ml", { n: v })} />,
    },
    eat.reactions.length > 0 && {
      ...eatCard, id: "eating.reactions", kicker: T("reactions"), headline: T("reactionsLogged", { count: eat.reactions.reduce((s, r) => s + r.value, 0) }),
      table: { columns: [T("reaction"), T("times")], rows: eat.reactions.map((r) => [r.label, r.value]) },
      chart: () => <TopBars data={eat.reactions} color="var(--chart-highlight)" />,
    },

    {
      ...actCard, id: "activity.top", kicker: t("modules.activity"), headline: act.headline, caption: T("timesLogged"), table: act.table,
      chart: () => (act.top.length ? <TopBars data={act.top} color="var(--chart-4)" /> : empty(T("nothingYet"))),
    },
    act.weekly.some((w) => w.value) && {
      ...actCard, id: "activity.minutes", kicker: T("activityTime"),
      headline: T("minutesPerWeek", { count: Math.round(act.weekly.reduce((s, w) => s + w.value, 0) / act.weekly.length) }),
      caption: T("minutesCaption"),
      table: { columns: [T("weekOf"), T("minutesCol")], rows: act.weekly.map((w) => [w.label, w.value]) },
      chart: () => <LabeledBars data={act.weekly} />,
    },

    {
      ...medCard, id: "medication.adherence", kicker: t("modules.medication"), headline: meds.headline, caption: T("adherenceCaption"), table: meds.adherenceTable, markers: true,
      chart: () => (meds.adherence.length ? <LabeledBars data={meds.adherence} domain={[0, 100]} format={(v) => T("pctValue", { value: v })} /> : empty(T("noScheduledMeds"))),
    },
    meds.points.length > 0 && {
      ...medCard, id: "medication.times", kicker: T("doseTimes"), headline: T("whenGiven"),
      table: { columns: [T("day"), T("time"), T("medication")], rows: meds.points.map((p) => [d8(p.day), hhmm(p.hour), p.name]) },
      chart: () => <DoseTimes points={meds.points} days={days} />,
    },
    {
      ...medCard, id: "medication.prn", kicker: T("asNeeded"), headline: meds.prnHeadline,
      caption: meds.followups ? T("followupCaption", { summary: meds.followups }) : undefined, table: meds.prnTable,
      chart: () => (meds.prnWeekly.length ? <LabeledBars data={meds.prnWeekly} /> : empty(T("noneLogged"))),
    },
  ];
  return cards.filter((c): c is TrendCard => !!c);
}

function foodsHeadline(foods: ReturnType<typeof rankFoods>, label: (key: string) => string): string {
  const best = foods.best && label(foods.best.key).toLowerCase();
  const refused = foods.refused && { refused: label(foods.refused.key).toLowerCase(), times: foods.refused.refused, logs: foods.refused.logs };
  if (best && refused) return T("foodsHeadline", { best, ...refused });
  if (best) return T("foodsHeadlineNoRefused", { best });
  if (refused) return T("foodsHeadlineRefusedOnly", refused);
  return T("foodsHeadlineMixed", { count: foods.ranked.length });
}

function introNote(outcome: "accepted" | "refused" | "neither", reactions: string[]): string {
  const how = outcome === "accepted" ? T("introAte") : outcome === "refused" ? T("introRefused") : T("introSome");
  return reactions.length ? `${how} · ${reactions.map((r) => labelFor(REACTIONS, r).toLowerCase()).join(", ")}` : how;
}
