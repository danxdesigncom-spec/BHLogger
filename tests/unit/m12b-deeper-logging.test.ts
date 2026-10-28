import { describe, expect, it } from "vitest";
import { generateHouseholdData, SEED_IDS, storyAnchor } from "@/lib/demo/generate";
import { validateEntryData } from "@/lib/schemas/entry";
import { followupDue } from "@/lib/meds/followup";
import { eatingTrend } from "@/lib/insights/trends";
import { durationLabel } from "@/lib/options";
import { entryDetail } from "@/lib/entries/summary";
import type { InsightEntry } from "@/lib/insights/core";

const data = generateHouseholdData({ anchor: storyAnchor(), tz: "America/Chicago" });

describe("EAT-08 / EAT-09 seed foods", () => {
  it("gives each child a foods list holding every food the story's meals use", () => {
    for (const profileId of [SEED_IDS.leo, SEED_IDS.maya]) {
      const listed = new Set(data.options.filter((o) => o.profile_id === profileId && o.module === "food").map((o) => o.key));
      const used = data.entries.filter((e) => e.profile_id === profileId).flatMap((e) => (e.data as { food_ids?: string[] }).food_ids ?? []);
      expect(used.length).toBeGreaterThan(0);
      for (const key of used) expect(listed.has(key)).toBe(true);
    }
    expect(data.options.find((o) => o.key === "mac_and_cheese")?.label).toBe("Mac and cheese");
  });

  it("marks Maya's first taste of each food as a new food, and nothing after", () => {
    const meals = data.entries.filter((e) => e.profile_id === SEED_IDS.maya && (e.data as { food_ids?: string[] }).food_ids?.length)
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const firsts = new Set<string>();
    for (const e of meals) {
      const d = e.data as { food_ids: string[]; new_food?: boolean };
      const isNew = d.food_ids.some((f) => !firsts.has(f));
      expect(Boolean(d.new_food)).toBe(isNew);
      d.food_ids.forEach((f) => firsts.add(f));
    }
  });
});

describe("EAT-10 tube feeding", () => {
  it("validates a tube feed in ml", () => {
    expect(validateEntryData("eating", { method: "tube", formula_id: "opt_pediasure", amount_ml: 240, delivery: "bolus", flush_ml: 30 }).success).toBe(true);
    expect(validateEntryData("eating", { method: "tube", amount_ml: 0 }).success).toBe(false);
    expect(validateEntryData("eating", { method: "tube", amount_ml: 120, delivery: "drip" }).success).toBe(false);
  });

  it("totals formula per day for Trends", () => {
    const tube = (day: string, ml: number, flush?: number): InsightEntry =>
      ({ id: `${day}-${ml}`, type: "eating", occurred_at: `${day}T12:00:00.000Z`, tz: "UTC", deleted_at: null, profile_id: "p", data: { method: "tube", amount_ml: ml, ...(flush ? { flush_ml: flush } : {}) } }) as unknown as InsightEntry;
    const trend = eatingTrend([tube("2026-10-25", 240, 30), tube("2026-10-25", 240), tube("2026-10-26", 360)], ["2026-10-25", "2026-10-26"], "oz");
    expect(trend.hasTube).toBe(true);
    expect(trend.tube.map((d) => d.value)).toEqual([480, 360]);
    expect(trend.tubeHeadline).toBe("About 420 ml a day by tube");
    expect(trend.tubeTable.rows[0].slice(1)).toEqual([480, 30]);
  });

  it("describes a tube feed with its delivery and flush", () => {
    expect(entryDetail({ type: "eating", occurred_at: "", data: { method: "tube", amount_ml: 240, delivery: "continuous", flush_ml: 30 } })).toBe("Continuous or pump · flush 30 ml");
  });
});

describe("MOOD-04 behavior durations", () => {
  it("labels durations and shows them in the entry detail", () => {
    expect(durationLabel(15)).toBe("15 min");
    expect(durationLabel(60)).toBe("1 hour");
    expect(entryDetail({ type: "mood", occurred_at: "", data: { scope: "moment", level: 2, behaviors: [{ key: "meltdown", severity: "severe", duration_min: 15 }] } })).toBe("Severe · 15 min");
  });
});

describe("MED-12 follow-up", () => {
  const now = new Date("2026-10-26T19:05:00");
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
  const dose = (id: string, ago: number, extra: Record<string, unknown> = {}, loggedBy = "dad") => ({
    id, occurred_at: minsAgo(ago), logged_by: loggedBy, deleted_at: null,
    data: { medication_id: "ibu", outcome: "given", followup: null, ...extra },
  });
  const prn = new Set(["ibu"]);
  const admin = { userId: "mom", role: "admin" };

  it("asks from 30 minutes to 4 hours after a given as-needed dose", () => {
    expect(followupDue([dose("a", 20)], prn, now, admin)).toHaveLength(0);
    expect(followupDue([dose("a", 30)], prn, now, admin)).toHaveLength(1);
    expect(followupDue([dose("a", 240)], prn, now, admin)).toHaveLength(1);
    expect(followupDue([dose("a", 241)], prn, now, admin)).toHaveLength(0);
  });

  it("skips answered, refused, scheduled-med and deleted doses", () => {
    expect(followupDue([dose("a", 60, { followup: "helped" })], prn, now, admin)).toHaveLength(0);
    expect(followupDue([dose("a", 60, { outcome: "refused" })], prn, now, admin)).toHaveLength(0);
    expect(followupDue([dose("a", 60, { medication_id: "melatonin" })], prn, now, admin)).toHaveLength(0);
    expect(followupDue([{ ...dose("a", 60), deleted_at: minsAgo(1) }], prn, now, admin)).toHaveLength(0);
  });

  it("asks only someone who may edit the dose, newest first", () => {
    const doses = [dose("old", 200), dose("new", 45)];
    expect(followupDue(doses, prn, now, admin).map((d) => d.id)).toEqual(["new", "old"]);
    expect(followupDue(doses, prn, now, { userId: "dad", role: "caregiver" })).toHaveLength(2);
    expect(followupDue(doses, prn, now, { userId: "grandma", role: "caregiver" })).toHaveLength(0);
    expect(followupDue(doses, prn, now, { userId: "x", role: "viewer" })).toHaveLength(0);
  });
});
