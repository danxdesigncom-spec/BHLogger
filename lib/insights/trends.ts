// Trend cards (DSH-03 to DSH-08, DSH-10). Each returns a headline, chart series and a table.
import type { CareStage } from "@/lib/supabase/types";
import { activityLabel, behaviorLabel, feelingLabel, formatVolume, MEAL_TYPES, moodLabels, portionLabel, labelFor, consistencyText } from "./labels";
import { adherence, type MedLike } from "@/lib/meds/schedule";
import {
  activityStats, behaviorEvents, comparePeriods, countDaily, dataOf, isBm, isWet, localParts, longestBmGap, mean, moodDaily,
  moodHeatmap, perWeek, rollingAverage, round1, sumDaily, tally, type InsightEntry,
} from "./core";
import { shortDate } from "@/lib/dates";

const d8 = (day: string) => shortDate(new Date(`${day}T00:00:00`));
const pctPhrase = (cmp: ReturnType<typeof comparePeriods>, noun: string, span: number) =>
  cmp && cmp.direction !== "same" ? `${noun} ${cmp.direction} ${cmp.pct}% vs previous ${span} days` : null;

export interface MarkerLike { day: string; label: string }

// ─── Mood ────────────────────────────────────────────────────────────────────

export function moodTrend(inRange: InsightEntry[], previous: InsightEntry[], days: string[], markers: MarkerLike[], stage: CareStage) {
  const daily = moodDaily(inRange, days);
  const values = daily.filter((d) => d.avg !== null).map((d) => d.avg!);
  const avg = round1(mean(values));
  const prevAvg = round1(mean(previous.filter((e) => e.type === "mood" && Number(dataOf(e).level)).map((e) => Number(dataOf(e).level))));
  const labels = moodLabels(stage);

  let headline = avg === null ? "No mood logs in this range" : `Mood averaged ${avg.toFixed(1)} over ${days.length} days`;
  let averages: { from: string; to: string; value: number; label: string }[] = [];
  const marker = [...markers].reverse().find((m) => m.day > days[0] && m.day <= days[days.length - 1]);
  if (marker && avg !== null) {
    const before = round1(mean(daily.filter((d) => d.day < marker.day && d.avg !== null).map((d) => d.avg!)));
    const after = round1(mean(daily.filter((d) => d.day >= marker.day && d.avg !== null).map((d) => d.avg!)));
    if (before !== null && after !== null) {
      const dir = after > before + 0.1 ? "up" : after < before - 0.1 ? "down" : "about the same";
      headline = dir === "about the same"
        ? `Mood is about the same: ${after.toFixed(1)} average since ${d8(marker.day)}, ${before.toFixed(1)} before`
        : `Mood is ${dir}: ${after.toFixed(1)} average since ${d8(marker.day)}, ${before.toFixed(1)} before`;
      const lastBefore = daily.filter((d) => d.day < marker.day).at(-1)?.day ?? days[0];
      const beforeDays = days.filter((d) => d < marker.day).length;
      const afterDays = days.length - beforeDays;
      // Label a segment only when it's wide enough to hold the text; the headline carries the numbers.
      averages = [
        { from: days[0], to: lastBefore, value: before, label: beforeDays >= 6 ? `${before.toFixed(1)} before` : "" },
        { from: marker.day, to: days[days.length - 1], value: after, label: afterDays >= 6 ? `${after.toFixed(1)} after` : "" },
      ];
    }
  } else if (avg !== null) {
    const phrase = pctPhrase(comparePeriods(avg, prevAvg), "mood", days.length);
    if (phrase && prevAvg !== null) headline = `Mood averaged ${avg.toFixed(1)}, ${avg > prevAvg ? "up" : "down"} from ${prevAvg.toFixed(1)} the previous ${days.length} days`;
  }

  const feelings = tally(inRange.filter((e) => e.type === "mood").flatMap((e) => (dataOf(e).feelings as string[] | undefined) ?? [])).slice(0, 6);

  return {
    headline,
    daily,
    averages,
    caption: `Daily average · 1 = ${labels[0].toLowerCase()}, 5 = ${labels[4].toLowerCase()}`,
    table: { columns: ["Day", "Average", "Low", "High", "Logs"], rows: daily.filter((d) => d.n).map((d) => [d8(d.day), d.avg ?? "—", d.min ?? "—", d.max ?? "—", d.n]) },
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
  parts.push(perDay >= 0.8 && perDay <= 1.4 ? "About 1 BM a day" : `${round1(perDay)} BMs a day on average`);
  if (trailing >= 2) parts.push(`none in the last ${trailing} days`);
  let headline = parts.join("; ");
  const cmp = comparePeriods(total, prevTotal || null);
  if (cmp && cmp.direction !== "same" && trailing < 2) headline = `BMs ${cmp.direction} ${cmp.pct}% vs previous ${days.length} days`;

  const bands = trailing >= 2 ? [{ from: days[days.length - trailing], to: days[days.length - 1], label: "None" }] : [];
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
    caption: gap ? `Longest gap ${gap.days} days${bmAlertDays ? ` · alert at ${bmAlertDays}` : ""}` : `No BMs in this range`,
    table: { columns: ["Day", "BMs"], rows: bms.map((b) => [d8(b.day), b.count]) },
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
  let headline = events.length ? `${events.length} notable behaviors in ${days.length} days` : `No notable behaviors in ${days.length} days`;
  const marker = [...markers].reverse().find((m) => m.day > days[0] && m.day <= days[days.length - 1]);
  if (marker && top) {
    const name = behaviorLabel(top.key);
    const after = events.filter((b) => b.key === top.key && localParts(b.entry).day >= marker.day).length;
    const before = events.filter((b) => b.key === top.key && localParts(b.entry).day < marker.day).length;
    const beforeDays = days.filter((d) => d < marker.day).length;
    headline = `${name}s: ${after} since ${d8(marker.day)}, ${before} in the ${beforeDays} days before`;
  } else {
    const cmp = comparePeriods(events.length, behaviorEvents(previous).length || null);
    const phrase = pctPhrase(cmp, "Behaviors", days.length);
    if (phrase) headline = phrase;
  }
  const counts = tally(events.map((b) => b.key));
  const severe = events.filter((b) => b.severity === "severe").length;
  return {
    headline,
    series: byDay,
    weekly: perWeek(byDay, (r) => r.value),
    caption: severe ? `${severe} marked severe` : `${events.length} logged`,
    table: { columns: ["Behavior", "Count", "Severe"], rows: counts.map((c) => [behaviorLabel(c.key), c.count, events.filter((b) => b.key === c.key && b.severity === "severe").length]) },
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
    feedsHeadline: hasFeeds ? `About ${avgFeeds} feeds a day${avgVolume ? `, ${formatVolume(avgVolume, unit)} from bottles` : ""}` : "",
    portions,
    portionsHeadline: lowest ? `${lowest.label} is usually the smallest meal (${portionLabel(Math.round((lowest.value ?? 0) / 25) * 25).toLowerCase()})` : "",
    drinks: drinks.map((d) => ({ day: d.day, value: d.count })),
    reactions: tally(reactions.map((x) => x.r)).map((t) => ({ label: labelFor("reaction", t.key), value: t.count })),
    table: { columns: ["Meal", "Average eaten", "Logs"], rows: portions.map((p) => [p.label, `${p.value}%`, p.n]) },
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
      ? favorite ? `${activityLabel(favorite.key)} is the favorite (${favorite.enjoyment!.toFixed(1)} of 5)` : `${activityLabel(stats[0].key)} is the most frequent`
      : "No activities logged in this range",
    top: stats.slice(0, 6).map((s) => ({ label: activityLabel(s.key), value: s.count })),
    weekly: weekly.map((w) => ({ label: d8(w.week), value: w.value })),
    table: { columns: ["Activity", "Times", "Avg enjoyment", "Minutes"], rows: stats.map((s) => [activityLabel(s.key), s.count, s.enjoyment ?? "not rated", s.minutes]) },
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
    return { day: p.day, hour: p.hour + p.minute / 60, name: meds.find((m) => m.id === dataOf(e).medication_id)?.name ?? "Medication" };
  }).filter((p) => days.includes(p.day));

  return {
    headline: adh.length ? (worst.a.pct === 100 ? "Every scheduled dose was given" : `${worst.med.name} was given ${worst.a.pct}% of the time`) : "No scheduled doses in this range",
    adherence: adh.map((x) => ({ label: x.med.name, value: x.a.pct })),
    adherenceTable: {
      columns: ["Medication", "Given", "Partial", "Refused", "Spit up", "Skipped", "Not logged", "Scheduled", "%"],
      rows: adh.map((x) => [x.med.name, x.a.given, x.a.partial, x.a.refused, x.a.spitUp, x.a.skipped, x.a.notLogged, x.a.scheduled, `${x.a.pct}%`]),
    },
    prnHeadline: prn.length ? `${prn.length} as-needed dose${prn.length === 1 ? "" : "s"}, most often for ${labelFor("prn", reasons[0]?.key ?? "other").toLowerCase()}` : "No as-needed doses in this range",
    prnWeekly: prnWeekly.map((w) => ({ label: d8(w.week), value: w.value })),
    prnTable: { columns: ["Reason", "Doses"], rows: reasons.map((r) => [labelFor("prn", r.key), r.count]) },
    followups: followups.map((f) => `${f.count} ${f.key === "didnt_help" ? "didn't help" : f.key}`).join(" · "),
    points,
  };
}

