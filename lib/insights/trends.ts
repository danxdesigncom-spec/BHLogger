// Trend cards (DSH-03 to DSH-08, DSH-10). Each returns a headline, chart series and a table.
import type { CareStage } from "@/lib/supabase/types";
import { activityLabel, behaviorLabel, feelingLabel, formatVolume, MEAL_TYPES, moodLabels, portionLabel, labelFor, consistencyText } from "./labels";
import { adherence, type MedLike } from "@/lib/meds/schedule";
import {
  activityStats, behaviorEvents, comparePeriods, countDaily, dataOf, isBm, isWet, localParts, longestBmGap, mean, moodDaily,
  moodHeatmap, perWeek, rollingAverage, round1, sumDaily, tally, type InsightEntry,
} from "./core";
import { shortDate } from "@/lib/dates";
import { t } from "@/lib/i18n";

const T = (k: string, v?: Record<string, string | number>) => t(`insights.trends.${k}`, v);
const dir = (d: "up" | "down") => T(d);

const d8 = (day: string) => shortDate(new Date(`${day}T00:00:00`));

export interface MarkerLike { day: string; label: string }

// ─── Mood ────────────────────────────────────────────────────────────────────

export function moodTrend(inRange: InsightEntry[], previous: InsightEntry[], days: string[], markers: MarkerLike[], stage: CareStage) {
  const daily = moodDaily(inRange, days);
  const values = daily.filter((d) => d.avg !== null).map((d) => d.avg!);
  const avg = round1(mean(values));
  const prevAvg = round1(mean(previous.filter((e) => e.type === "mood" && Number(dataOf(e).level)).map((e) => Number(dataOf(e).level))));
  const labels = moodLabels(stage);

  let headline = avg === null ? T("moodNone") : T("moodAveraged", { avg: avg.toFixed(1), days: days.length });
  let averages: { from: string; to: string; value: number; label: string }[] = [];
  const marker = [...markers].reverse().find((m) => m.day > days[0] && m.day <= days[days.length - 1]);
  if (marker && avg !== null) {
    const before = round1(mean(daily.filter((d) => d.day < marker.day && d.avg !== null).map((d) => d.avg!)));
    const after = round1(mean(daily.filter((d) => d.day >= marker.day && d.avg !== null).map((d) => d.avg!)));
    if (before !== null && after !== null) {
      const direction = after > before + 0.1 ? T("up") : after < before - 0.1 ? T("down") : T("aboutSame");
      headline = T("moodSince", { direction, after: after.toFixed(1), date: d8(marker.day), before: before.toFixed(1) });
      const lastBefore = daily.filter((d) => d.day < marker.day).at(-1)?.day ?? days[0];
      const beforeDays = days.filter((d) => d < marker.day).length;
      const afterDays = days.length - beforeDays;
      // Label a segment only when it's wide enough to hold the text; the headline carries the numbers.
      averages = [
        { from: days[0], to: lastBefore, value: before, label: beforeDays >= 6 ? T("before", { value: before.toFixed(1) }) : "" },
        { from: marker.day, to: days[days.length - 1], value: after, label: afterDays >= 6 ? T("after", { value: after.toFixed(1) }) : "" },
      ];
    }
  } else if (avg !== null) {
    const cmp = comparePeriods(avg, prevAvg);
    if (cmp && cmp.direction !== "same" && prevAvg !== null) {
      headline = T("moodVsPrevious", { avg: avg.toFixed(1), direction: dir(cmp.direction), previous: prevAvg.toFixed(1), days: days.length });
    }
  }

  const feelings = tally(inRange.filter((e) => e.type === "mood").flatMap((e) => (dataOf(e).feelings as string[] | undefined) ?? [])).slice(0, 6);

  return {
    headline,
    daily,
    averages,
    caption: T("moodCaption", { low: labels[0].toLowerCase(), high: labels[4].toLowerCase() }),
    table: { columns: [T("day"), T("average"), T("low"), T("high"), T("logs")], rows: daily.filter((d) => d.n).map((d) => [d8(d.day), d.avg ?? "—", d.min ?? "—", d.max ?? "—", d.n]) },
    heatmap: moodHeatmap(inRange),
    feelings: feelings.map((f) => ({ label: feelingLabel(f.key), value: f.count })),
    logCount: inRange.filter((e) => e.type === "mood").length,
  };
}

// ─── Bathroom ────────────────────────────────────────────────────────────────

export function bathroomTrend(inRange: InsightEntry[], previous: InsightEntry[], days: string[], from: Date, to: Date, stage: CareStage, toileting: string, bmAlertDays: number | null) {
  const bms = countDaily(inRange, days, isBm);
  const avgLine = rollingAverage(bms.map((b) => b.count));
  const total = bms.reduce((s, b) => s + b.count, 0);
  const perDay = total / days.length;
  const prevTotal = previous.filter(isBm).length;

  let trailing = 0;
  for (let i = bms.length - 1; i >= 0 && bms[i].count === 0; i--) trailing++;
  const parts: string[] = [];
  parts.push(perDay >= 0.8 && perDay <= 1.4 ? T("aboutOneBm") : T("bmsPerDay", { count: round1(perDay) ?? 0 }));
  if (trailing >= 2) parts.push(T("noneLastDays", { count: trailing }));
  let headline = parts.join("; ");
  const cmp = comparePeriods(total, prevTotal || null);
  if (cmp && cmp.direction !== "same" && trailing < 2) headline = T("bmsVsPrevious", { direction: dir(cmp.direction), pct: cmp.pct, days: days.length });

  const bands = trailing >= 2 ? [{ from: days[days.length - trailing], to: days[days.length - 1], label: T("noneBand") }] : [];
  const gap = longestBmGap(inRange, from, to);

  const scaleCounts = tally(inRange.filter(isBm).map((e) => dataOf(e).consistency).filter((c) => c !== undefined).map((c) => String(c)));
  const wet = stage === "baby" || toileting === "diapers" ? countDaily(inRange, days, isWet) : null;
  const training = toileting === "training"
    ? days.map((day) => {
        const today = inRange.filter((e) => e.type === "bathroom" && localParts(e).day === day);
        return { day, toilet: today.filter((e) => dataOf(e).location === "toilet").length, accident: today.filter((e) => dataOf(e).location === "accident").length };
      })
    : null;

  return {
    headline,
    series: bms.map((b, i) => ({ day: b.day, value: b.count, avg: avgLine[i] })),
    bands,
    caption: gap ? `${T("longestGap", { days: gap.days })}${bmAlertDays ? T("alertAt", { days: bmAlertDays }) : ""}` : T("noBmsRange"),
    table: { columns: [T("day"), T("bms")], rows: bms.map((b) => [d8(b.day), b.count]) },
    consistency: scaleCounts.map((s) => ({ label: consistencyText(s.key), value: s.count })),
    wet,
    training,
  };
}

// ─── Behaviors ───────────────────────────────────────────────────────────────

export function behaviorTrend(inRange: InsightEntry[], previous: InsightEntry[], days: string[], markers: MarkerLike[]) {
  const events = behaviorEvents(inRange);
  const byDay = days.map((day) => ({ day, value: events.filter((b) => localParts(b.entry).day === day).length }));
  const top = tally(events.map((b) => b.key))[0];
  let headline = events.length ? T("behaviorsIn", { count: events.length, days: days.length }) : T("noBehaviorsIn", { days: days.length });
  const marker = [...markers].reverse().find((m) => m.day > days[0] && m.day <= days[days.length - 1]);
  if (marker && top) {
    const name = behaviorLabel(top.key);
    const after = events.filter((b) => b.key === top.key && localParts(b.entry).day >= marker.day).length;
    const before = events.filter((b) => b.key === top.key && localParts(b.entry).day < marker.day).length;
    const beforeDays = days.filter((d) => d < marker.day).length;
    headline = T("behaviorSince", { name, after, date: d8(marker.day), before, days: beforeDays });
  } else {
    const cmp = comparePeriods(events.length, behaviorEvents(previous).length || null);
    if (cmp && cmp.direction !== "same") headline = T("behaviorsVsPrevious", { direction: dir(cmp.direction), pct: cmp.pct, days: days.length });
  }
  const counts = tally(events.map((b) => b.key));
  const severe = events.filter((b) => b.severity === "severe").length;
  return {
    headline,
    series: byDay,
    weekly: perWeek(byDay, (r) => r.value),
    caption: severe ? T("markedSevere", { count: severe }) : T("loggedCount", { count: events.length }),
    table: { columns: [T("behavior"), T("count"), T("severe")], rows: counts.map((c) => [behaviorLabel(c.key), c.count, events.filter((b) => b.key === c.key && b.severity === "severe").length]) },
  };
}

// ─── Eating ──────────────────────────────────────────────────────────────────

export function eatingTrend(inRange: InsightEntry[], days: string[], unit: "ml" | "oz") {
  const eating = inRange.filter((e) => e.type === "eating");
  const isFeed = (e: InsightEntry) => e.type === "eating" && ["breast", "bottle"].includes(String(dataOf(e).method));
  const feeds = countDaily(inRange, days, isFeed);
  const volume = sumDaily(inRange, days, (e) => isFeed(e) && typeof dataOf(e).amount_ml === "number", (e) => Number(dataOf(e).amount_ml));
  const hasFeeds = feeds.some((f) => f.count > 0);
  const avgFeeds = round1(mean(feeds.map((f) => f.count)));
  const avgVolume = mean(volume.map((v) => v.value));

  const portions = MEAL_TYPES.map((m) => {
    const vals = eating.filter((e) => dataOf(e).method === "meal" && dataOf(e).meal_type === m.key && dataOf(e).portion_pct !== undefined).map((e) => Number(dataOf(e).portion_pct));
    return { label: m.label, value: vals.length ? Math.round(mean(vals)!) : null, n: vals.length };
  }).filter((p) => p.n > 0);
  const drinks = countDaily(inRange, days, (e) => e.type === "eating" && dataOf(e).method === "drink");
  const reactions = eating.flatMap((e) => ((dataOf(e).reactions as string[] | undefined) ?? []).map((r) => ({ r, at: e.occurred_at })));
  const lowest = [...portions].sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];

  return {
    hasFeeds,
    feeds: feeds.map((f) => ({ day: f.day, value: f.count })),
    volume: volume.map((v) => ({ day: v.day, value: unit === "oz" ? Math.round((v.value / 29.5735) * 10) / 10 : v.value })),
    feedsHeadline: hasFeeds ? (avgVolume ? T("feedsAndVolume", { count: avgFeeds ?? 0, amount: formatVolume(avgVolume, unit) }) : T("feedsPerDay", { count: avgFeeds ?? 0 })) : "",
    portions,
    portionsHeadline: lowest ? T("smallestMeal", { meal: lowest.label, portion: portionLabel(Math.round((lowest.value ?? 0) / 25) * 25).toLowerCase() }) : "",
    drinks: drinks.map((d) => ({ day: d.day, value: d.count })),
    reactions: tally(reactions.map((x) => x.r)).map((r) => ({ label: labelFor("reaction", r.key), value: r.count })),
    table: { columns: [T("meal"), T("averageEaten"), T("logs")], rows: portions.map((p) => [p.label, `${p.value}%`, p.n]) },
  };
}

// ─── Activity ────────────────────────────────────────────────────────────────

export function activityTrend(inRange: InsightEntry[], days: string[]) {
  const stats = activityStats(inRange);
  const minutes = sumDaily(inRange, days, (e) => e.type === "activity" && typeof dataOf(e).duration_min === "number", (e) => Number(dataOf(e).duration_min));
  const weekly = perWeek(minutes.map((m) => ({ day: m.day, value: m.value })), (r) => r.value);
  const favorite = [...stats].filter((s) => s.rated >= 2).sort((a, b) => (b.enjoyment ?? 0) - (a.enjoyment ?? 0))[0];
  return {
    headline: stats.length
      ? favorite ? T("favorite", { name: activityLabel(favorite.key), score: favorite.enjoyment!.toFixed(1) }) : T("mostFrequent", { name: activityLabel(stats[0].key) })
      : T("noActivities"),
    top: stats.slice(0, 6).map((s) => ({ label: activityLabel(s.key), value: s.count })),
    weekly: weekly.map((w) => ({ label: d8(w.week), value: w.value })),
    table: { columns: [T("activity"), T("times"), T("avgEnjoyment"), T("minutesCol")], rows: stats.map((s) => [activityLabel(s.key), s.count, s.enjoyment ?? T("notRated"), s.minutes]) },
  };
}

// ─── Medication ──────────────────────────────────────────────────────────────

export function medsTrend(inRange: InsightEntry[], days: string[], from: Date, to: Date, meds: (MedLike & { name: string })[], now: Date) {
  const doses = inRange.filter((e) => e.type === "medication");
  const scheduled = meds.filter((m) => m.kind === "scheduled");
  const adh = scheduled.map((m) => ({ med: m, a: adherence(m, doses as never, from, to, now) })).filter((x) => x.a.scheduled > 0);
  const prn = doses.filter((e) => meds.find((m) => m.id === dataOf(e).medication_id)?.kind === "prn");
  const prnWeekly = perWeek(prn.map((e) => ({ day: localParts(e).day })), () => 1);
  const reasons = tally(prn.map((e) => String(dataOf(e).prn_reason ?? "other")));
  const followups = tally(prn.map((e) => dataOf(e).followup).filter(Boolean).map(String));
  const worst = [...adh].sort((a, b) => (a.a.pct ?? 0) - (b.a.pct ?? 0))[0];
  const points = doses.map((e) => {
    const p = localParts(e);
    return { day: p.day, hour: p.hour + p.minute / 60, name: meds.find((m) => m.id === dataOf(e).medication_id)?.name ?? T("medication") };
  }).filter((p) => days.includes(p.day));

  return {
    headline: adh.length ? (worst.a.pct === 100 ? T("everyDoseGiven") : T("givenPct", { name: worst.med.name, pct: worst.a.pct ?? 0 })) : T("noScheduledRange"),
    adherence: adh.map((x) => ({ label: x.med.name, value: x.a.pct })),
    adherenceTable: {
      columns: [T("medication"), T("given"), T("partial"), T("refused"), T("spitUp"), T("skipped"), T("notLogged"), T("scheduled"), T("pct")],
      rows: adh.map((x) => [x.med.name, x.a.given, x.a.partial, x.a.refused, x.a.spitUp, x.a.skipped, x.a.notLogged, x.a.scheduled, `${x.a.pct}%`]),
    },
    prnHeadline: prn.length ? T("prnCount", { count: prn.length, reason: labelFor("prn", reasons[0]?.key ?? "other").toLowerCase() }) : T("noPrn"),
    prnWeekly: prnWeekly.map((w) => ({ label: d8(w.week), value: w.value })),
    prnTable: { columns: [T("reason"), T("doses")], rows: reasons.map((r) => [labelFor("prn", r.key), r.count]) },
    followups: followups.map((f) => T("followupCount", { count: f.count, answer: labelFor("followup", f.key).toLowerCase() })).join(" · "),
    points,
  };
}

