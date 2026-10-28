import { describe, it, expect } from "vitest";
import { comparePeriods, eachDay, localParts, longestBmGap, moodDaily, type InsightEntry } from "@/lib/insights/core";
import { beforeAfterChange, hardestTimeOfDay, latestChange, moodAndBms } from "@/lib/insights/patterns";
import { generateHouseholdData, SEED_IDS, storyAnchor } from "@/lib/demo/generate";

let n = 0;
const mood = (iso: string, level: number, scope = "moment", tz = "America/Chicago"): InsightEntry => ({
  id: `m${n++}`, type: "mood", occurred_at: iso, tz, data: { scope, level, feelings: [], behaviors: [] },
});

describe("local time", () => {
  it("uses each entry's own time zone", () => {
    const e = { occurred_at: "2026-10-27T03:30:00Z", tz: "America/Chicago" };
    expect(localParts(e)).toMatchObject({ day: "2026-10-26", hour: 22 });
    expect(localParts({ ...e, tz: "Europe/Madrid" })).toMatchObject({ day: "2026-10-27", hour: 4 });
  });
});

describe("DSH-05 daily mood", () => {
  it("prefers the day-level rating over the average", () => {
    const days = ["2026-10-26"];
    const out = moodDaily([mood("2026-10-26T15:00:00Z", 2), mood("2026-10-26T18:00:00Z", 4), mood("2026-10-26T23:00:00Z", 5, "day")], days);
    expect(out[0]).toMatchObject({ avg: 5, min: 2, max: 4, dayRating: true });
  });
});

describe("AT-11 pattern threshold", () => {
  it("shows Keep logging with progress toward 14 days when there are 10 days of mood data", () => {
    const entries: InsightEntry[] = [];
    for (let d = 1; d <= 10; d++) for (const h of [9, 13, 17, 18]) entries.push(mood(`2026-10-${String(d).padStart(2, "0")}T${h + 5}:00:00Z`, 3));
    const r = hardestTimeOfDay(entries);
    expect(r.status).toBe("keep_logging");
    if (r.status === "keep_logging") {
      expect(r.progress).toBe(10);
      expect(r.goal).toBe(14);
    }
  });
});

describe("patterns on the mockup story", () => {
  const anchor = storyAnchor();
  const data = generateHouseholdData({ anchor, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const leo = data.entries.filter((e) => e.profile_id === SEED_IDS.leo);
  const from = new Date(anchor.getTime() - 30 * 86_400_000);
  const last30 = leo.filter((e) => new Date(e.occurred_at) >= from);

  it("PAT-01 finds 4 to 7 PM hardest", () => {
    const r = hardestTimeOfDay(last30);
    expect(r.status).toBe("ready");
    if (r.status === "ready") expect(r.hardest.label).toBe("4–7 PM");
  });

  it("PAT-02 shows lower mood on days without a BM", () => {
    const r = moodAndBms(last30, from, anchor);
    expect(r.status).toBe("ready");
    if (r.status === "ready") expect(r.without).toBeLessThan(r.with);
  });

  it("PAT-03 compares 14 days either side of the melatonin change", () => {
    const changes = data.medicationChanges.filter((c) => c.medication_id === SEED_IDS.leoMelatonin);
    const change = latestChange(changes, anchor)!;
    expect(change.change_type).toBe("dose_changed");
    const r = beforeAfterChange(leo, change, anchor);
    expect(r.status).toBe("ready");
    if (r.status === "ready") expect(r.after.mood!).toBeGreaterThan(r.before.mood!);
  });
});

describe("bathroom gaps and comparisons", () => {
  it("finds the longest gap between BMs", () => {
    const bm = (iso: string): InsightEntry => ({ id: `b${n++}`, type: "bathroom", occurred_at: iso, tz: "UTC", data: { kind: "bm" } });
    const gap = longestBmGap([bm("2026-10-01T12:00:00Z"), bm("2026-10-02T12:00:00Z"), bm("2026-10-06T12:00:00Z")], new Date("2026-10-01T00:00:00Z"), new Date("2026-10-07T00:00:00Z"));
    expect(gap?.days).toBe(4);
  });

  it("compares periods only when both have data (DSH-10)", () => {
    expect(comparePeriods(3, 5)).toEqual({ pct: 40, direction: "down" });
    expect(comparePeriods(3, null)).toBeNull();
  });

  it("lists every day in a range", () => {
    expect(eachDay(new Date(2026, 9, 30), new Date(2026, 10, 2))).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});
