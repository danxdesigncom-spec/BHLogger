import { beforeEach, describe, expect, it } from "vitest";
import type { InsightEntry } from "@/lib/insights/core";
import { foodIntroductions, foodStats, mealOutcome, rankFoods } from "@/lib/insights/foods";
import { activitiesThatLift, eatingAndMood, PATTERN_RULES, prnTiming, weekdayMood } from "@/lib/insights/patterns";
import { reportPatterns } from "@/lib/reports/patterns";
import { addReportItem, chartItemId, hasReportItem, removeReportItem, reportItems } from "@/lib/report-items";
import { DEFAULT_CARD_FIELDS, parseCardFields, reportHref } from "@/lib/reports/templates";
import { cardFieldText, isCardEmpty, readCareCard, telHref } from "@/lib/carecard";
import { entryDetail } from "@/lib/entries/summary";
import { weekdayName } from "@/lib/dates";
import { safeNext } from "@/lib/auth/safe-next";
import { generateHouseholdData, SEED_IDS, storyAnchor } from "@/lib/demo/generate";

// M12c: food insights (DSH-09), Add to report (DSH-12), PAT-04 to PAT-07, care card fields (RPT-09)
// and the care card view (ACC-12).
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
let n = 0;
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString(); // October 2026, local time
const entry = (type: string, occurred_at: string, data: Record<string, unknown>): InsightEntry => ({ id: `e${n++}`, type, occurred_at, tz: TZ, data });
const meal = (day: number, foods: string[], portion?: number, extra: Record<string, unknown> = {}) =>
  entry("eating", at(day, 12), { method: "meal", meal_type: "lunch", food_ids: foods, ...(portion === undefined ? {} : { portion_pct: portion }), ...extra });
const mood = (day: number, hour: number, level: number) => entry("mood", at(day, hour), { scope: "moment", level, feelings: [], behaviors: [] });

describe("DSH-09 accepted and refused", () => {
  it("works it out from the portion and reactions", () => {
    expect(mealOutcome(meal(1, ["peas"], 25))).toBe("refused");
    expect(mealOutcome(meal(1, ["peas"], 100, { reactions: ["refused"] }))).toBe("refused");
    expect(mealOutcome(meal(1, ["peas"], 50))).toBe("accepted");
    expect(mealOutcome(meal(1, ["peas"], 30))).toBe("neither");
    expect(mealOutcome(meal(1, ["peas"]))).toBe("neither");
  });

  it("ranks foods logged 3 or more times, in one list, best first", () => {
    const es = [
      ...[100, 100, 75].map((p, i) => meal(i + 1, ["apple"], p)),
      ...[25, 25, 75, 100].map((p, i) => meal(i + 1, ["peas"], p)),
      meal(1, ["cake"], 100), meal(2, ["cake"], 100),
    ];
    const r = rankFoods(foodStats(es));
    expect(r.ranked.map((f) => f.key)).toEqual(["apple", "peas"]);
    expect(r.best?.key).toBe("apple");
    expect(r.refused).toMatchObject({ key: "peas", refused: 2, logs: 4 });
    expect(r.hidden).toBe(0);
  });

  it("shows the best and most refused four when more than eight foods are ranked", () => {
    const es = Array.from({ length: 10 }, (_, f) => [1, 2, 3].map((d) => meal(d, [`food${f}`], f < 5 ? 100 : 25))).flat();
    const r = rankFoods(foodStats(es));
    expect(r.rows).toHaveLength(8);
    expect(r.hidden).toBe(2);
  });

  it("lists new foods oldest first, with reactions other than refused", () => {
    const es = [meal(5, ["egg"], 50, { new_food: true, reactions: ["rash_hives"] }), meal(2, ["peanut"], 25, { new_food: true }), meal(3, ["rice"], 75)];
    const intros = foodIntroductions(es);
    expect(intros.map((i) => i.foods[0])).toEqual(["peanut", "egg"]);
    expect(intros[0].outcome).toBe("refused");
    expect(intros[1].reactions).toEqual(["rash_hives"]);
  });

  it("uses names from the foods list in entry details", () => {
    const e = meal(1, ["opt_abc", "mac_and_cheese"], 50);
    expect(entryDetail(e)).toContain("Abc");
    expect(entryDetail(e, { optionLabel: (_m, k) => (k === "opt_abc" ? "Grandma's soup" : "Mac and cheese") })).toContain("Grandma's soup, mac and cheese");
  });
});

describe("PAT-04 activities that lift mood", () => {
  const swim = (day: number) => entry("activity", at(day, 10), { activity_id: "swimming", duration_min: 60 });
  const base = () => Array.from({ length: 10 }, (_, d) => mood(d + 1, 8, 3));

  it("compares mood in the 2 hours after an activity ends with the overall average", () => {
    const es = [...base(), ...[1, 2, 3, 4, 5].flatMap((d) => [swim(d), mood(d, 12, 5)])];
    const r = activitiesThatLift(es);
    expect(r.status).toBe("ready");
    if (r.status === "ready") expect(r.lifts[0]).toMatchObject({ key: "swimming", times: 5, avg: 5 });
  });

  it("needs 5 times with a mood log afterwards, and ignores mood logged outside the window", () => {
    const es = [...base(), ...[1, 2, 3, 4].flatMap((d) => [swim(d), mood(d, 12, 5)]), swim(5), mood(5, 15, 5)];
    const r = activitiesThatLift(es);
    expect(r).toMatchObject({ status: "keep_logging", progress: 4, goal: PATTERN_RULES.PAT04_MIN_TIMES });
  });

  it("says no activity stood out when none beats the average by 0.3", () => {
    const es = [...base(), ...[1, 2, 3, 4, 5].flatMap((d) => [swim(d), mood(d, 12, 3)])];
    expect(activitiesThatLift(es).status).toBe("no_pattern");
  });
});

describe("PAT-05 best and hardest weekday", () => {
  const from = new Date(2026, 8, 28); // Mon, Sep 28
  const days = (count: number, level: (d: Date) => number) =>
    Array.from({ length: count }, (_, i) => {
      const d = new Date(2026, 8, 28 + i, 9);
      return entry("mood", d.toISOString(), { scope: "moment", level: level(d), feelings: [], behaviors: [] });
    });

  it("calls out the hardest and best day after 4 weeks", () => {
    const es = days(28, (d) => (d.getDay() === 1 ? 2 : d.getDay() === 6 ? 5 : 3));
    const r = weekdayMood(es, from, new Date(2026, 9, 25, 23));
    expect(r.status).toBe("ready");
    if (r.status === "ready") {
      expect(r.hardest).toMatchObject({ weekday: 1, avg: 2 });
      expect(r.best).toMatchObject({ weekday: 6, avg: 5 });
    }
    expect(weekdayName(1)).toBe("Monday");
  });

  it("keeps logging until every weekday has 4 days, and reports a flat week as no pattern", () => {
    expect(weekdayMood(days(21, () => 3), from, new Date(2026, 9, 18, 23))).toMatchObject({ status: "keep_logging", progress: 3, goal: 4 });
    expect(weekdayMood(days(28, () => 3), from, new Date(2026, 9, 25, 23)).status).toBe("no_pattern");
  });
});

describe("PAT-06 eating and mood", () => {
  const from = new Date(2026, 9, 1);
  const to = new Date(2026, 9, 31, 23);
  it("compares portions on low-mood days with other days", () => {
    const es = Array.from({ length: 10 }, (_, i) => [mood(i + 1, 9, i < 5 ? 2 : 4), meal(i + 1, ["rice"], i < 5 ? 25 : 75)]).flat();
    expect(eatingAndMood(es, from, to)).toMatchObject({ status: "ready", low: 25, other: 75, lowDays: 5, otherDays: 5 });
  });
  it("needs 5 days in each group", () => {
    const es = Array.from({ length: 9 }, (_, i) => [mood(i + 1, 9, i < 4 ? 2 : 4), meal(i + 1, ["rice"], 50)]).flat();
    expect(eatingAndMood(es, from, to)).toMatchObject({ status: "keep_logging", progress: 4 });
  });
});

describe("PAT-07 as-needed timing", () => {
  const med = { id: "ibu", name: "Ibuprofen" };
  const dose = (day: number, hour: number, outcome = "given", reason = "pain") => entry("medication", at(day, hour), { medication_id: "ibu", outcome, prn_reason: reason });

  it("finds the most common time block and reason after 5 doses", () => {
    const r = prnTiming([dose(1, 17), dose(2, 17), dose(3, 18), dose(4, 9, "given", "fever"), dose(5, 16)], [med]);
    expect(r[0]).toMatchObject({ status: "ready", doses: 5, top: { key: "late_pm", count: 4 }, reason: { key: "pain", count: 4 } });
  });

  it("doesn't count refused doses and skips medications with none", () => {
    const r = prnTiming([dose(1, 17), dose(2, 17), dose(3, 18), dose(4, 9), dose(5, 16, "refused")], [med, { id: "other", name: "Other" }]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ status: "keep_logging", progress: 4, goal: 5 });
  });
});

describe("report pattern lines", () => {
  it("lists the story's patterns with ids the Patterns screen uses", () => {
    const anchor = storyAnchor();
    const data = generateHouseholdData({ anchor, tz: TZ });
    const from = new Date(anchor);
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - 29);
    const all = data.entries.filter((e) => e.profile_id === SEED_IDS.leo) as unknown as InsightEntry[];
    const inRange = all.filter((e) => e.occurred_at >= from.toISOString() && e.occurred_at <= anchor.toISOString());
    const meds = data.medications.filter((m) => m.profile_id === SEED_IDS.leo);
    const lines = reportPatterns({
      inRange, all, from, to: anchor, fromYmd: "2026-09-27", name: "Leo",
      changes: data.medicationChanges.filter((c) => meds.some((m) => m.id === c.medication_id)),
      prnMeds: meds.filter((m) => m.kind === "prn").map((m) => ({ id: m.id, name: m.name })),
      medName: (id) => meds.find((m) => m.id === id)?.name ?? "",
      activityName: (k) => k,
    });
    const ids = lines.map((l) => l.id);
    expect(ids).toContain("pat01");
    expect(ids.some((id) => id.startsWith("pat03:"))).toBe(true);
    expect(lines.every((l) => l.line.length > 20)).toBe(true);
  });
});

describe("DSH-12 report items", () => {
  // Node's own localStorage global is undefined without --localstorage-file, so give the test a simple one.
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
    });
  });

  it("are kept per profile, and older items without a profile are dropped", () => {
    localStorage.setItem("bl-report-items", JSON.stringify([{ id: "pat01", title: "Old", detail: "" }]));
    addReportItem({ id: chartItemId("mood.feelings"), profileId: "leo", kind: "chart", title: "Feelings", detail: "Calm came up most" });
    expect(reportItems("leo")).toHaveLength(1);
    expect(reportItems("maya")).toHaveLength(0);
    expect(hasReportItem("leo", "chart:mood.feelings")).toBe(true);
    removeReportItem("maya", "chart:mood.feelings");
    expect(reportItems("leo")).toHaveLength(1);
    removeReportItem("leo", "chart:mood.feelings");
    expect(reportItems("leo")).toHaveLength(0);
  });
});

describe("RPT-09 and ACC-12 care card", () => {
  const card = {
    allergies: ["Peanuts"], conditions: [], communication_notes: " Short sentences ", calming_strategies: ["Blanket"],
    emergency_contacts: [{ name: "Mom", relationship: "Parent", phone: "312-555-0101" }, { name: "" }], doctor: { name: "Dr. Chen", phone: "+1 (312) 555-0100" },
  };

  it("prints only the chosen fields, with contacts off by default", () => {
    expect(parseCardFields(null)).toEqual(DEFAULT_CARD_FIELDS);
    expect(DEFAULT_CARD_FIELDS).not.toContain("contacts");
    expect(parseCardFields("allergies,bogus,contacts")).toEqual(["allergies", "contacts"]);
    expect(parseCardFields("")).toEqual([]);
    expect(reportHref({ profileId: "p", from: "a", to: "b", template: "doctor", sections: ["carecard"], cardFields: ["allergies"] })).toContain("cc=allergies");
    expect(cardFieldText(card, "contacts")).toBe("Mom (Parent), 312-555-0101");
    expect(cardFieldText(card, "communication")).toBe("Short sentences");
    expect(cardFieldText(card, "conditions")).toBe("");
  });

  it("reads stored cards safely and makes tap-to-call links", () => {
    expect(readCareCard(card).emergency_contacts).toHaveLength(1);
    expect(isCardEmpty(readCareCard(null))).toBe(true);
    expect(isCardEmpty(readCareCard({ allergies: "Peanuts" }))).toBe(true);
    expect(telHref("312-555-0101")).toBe("tel:3125550101");
    expect(telHref("+1 (312) 555-0100")).toBe("tel:+13125550100");
    expect(telHref("312-555-0101 ext. 12")).toBe("tel:3125550101");
    expect(telHref("312.555.0101 x4")).toBe("tel:3125550101");
    expect(telHref("ab")).toBeNull();
    expect(telHref(undefined)).toBeNull();
  });
});

describe("sign-in redirect", () => {
  it("only follows paths on this site", () => {
    expect(safeNext("/invite/abc?x=1")).toBe("/invite/abc?x=1");
    expect(safeNext(undefined)).toBe("/");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "@evil.example", "evil.example", "/ok\u0000", "javascript:alert(1)"]) {
      expect(safeNext(bad)).toBe("/");
    }
    expect(new URL(safeNext("@evil.example"), "http://localhost:3000").origin).toBe("http://localhost:3000");
  });
});
