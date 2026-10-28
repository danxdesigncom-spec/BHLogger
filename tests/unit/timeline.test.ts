import { describe, it, expect } from "vitest";
import { caregiverLabel, daySummary, describeRevision, groupByDay } from "@/lib/timeline";
import { entryDetail, entryTitle, tileStatus, type SummaryContext } from "@/lib/entries/summary";
import type { MedLike } from "@/lib/meds/schedule";

const at = (h: number, m = 0, day = 26) => new Date(2026, 9, day, h, m).toISOString();
let n = 0;
const e = (type: string, occurred_at: string, data: Record<string, unknown>) => ({ id: `e${n++}`, type, occurred_at, data, logged_by_name: "Mom" });

const child: SummaryContext = { careStage: "child", toileting: "toilet", volumeUnit: "oz", medicationName: (id) => (id === "ibu" ? "Ibuprofen" : undefined) };
const baby: SummaryContext = { careStage: "baby", toileting: "diapers", volumeUnit: "oz" };

describe("groupByDay", () => {
  it("groups newest day first with newest entries first", () => {
    const groups = groupByDay([e("mood", at(9, 0, 25), {}), e("mood", at(8), {}), e("mood", at(18), {})]);
    expect(groups).toHaveLength(2);
    expect(new Date(groups[0].entries[0].occurred_at).getHours()).toBe(18);
  });
});

describe("TL-04 day summary", () => {
  const meds: MedLike[] = [
    { id: "a", name: "A", kind: "scheduled", schedule: { times: ["08:00"] }, dose_window_min: 60, min_interval_hours: null, start_date: null, end_date: null, active: true },
    { id: "b", name: "B", kind: "scheduled", schedule: { times: ["12:00"] }, dose_window_min: 60, min_interval_hours: null, start_date: null, end_date: null, active: true },
    { id: "c", name: "C", kind: "scheduled", schedule: { times: ["19:30"] }, dose_window_min: 60, min_interval_hours: null, start_date: null, end_date: null, active: true },
  ];
  it("matches the S10 mockup: 3 meals · mood 3.2 average · meds 2 of 3", () => {
    const entries = [
      e("eating", at(7, 40), { method: "meal", meal_type: "breakfast" }),
      e("eating", at(12), { method: "meal", meal_type: "lunch" }),
      e("eating", at(18, 45), { method: "meal", meal_type: "dinner" }),
      e("mood", at(10), { scope: "moment", level: 4 }),
      e("mood", at(17, 30), { scope: "moment", level: 2 }),
      e("mood", at(13), { scope: "moment", level: 3.6 }),
      e("medication", at(8, 2), { medication_id: "a", outcome: "given", scheduled_for: at(8) }),
      e("medication", at(12, 15), { medication_id: "b", outcome: "given", scheduled_for: at(12) }),
    ];
    expect(daySummary(entries, new Date(2026, 9, 26), meds, "child", new Date(2026, 9, 26, 19, 5))).toBe("3 meals · mood 3.2 average · meds 2 of 3");
  });
});

describe("TL-05 revision wording", () => {
  it("describes a severity change like S11", () => {
    const before = { data: { scope: "moment", level: 2, behaviors: [{ key: "meltdown", severity: "mild" }] } };
    const after = { data: { scope: "moment", level: 2, behaviors: [{ key: "meltdown", severity: "moderate" }] } };
    expect(describeRevision(before, after, "child", () => "")).toEqual(["changed intensity from mild to moderate"]);
  });

  it("describes moving an entry to another profile", () => {
    expect(describeRevision({ profile_id: "leo" }, { profile_id: "maya" }, "child", () => "Maya")).toEqual(["moved it to Maya"]);
  });
});

describe("summaries", () => {
  it("formats mockup rows", () => {
    expect(entryTitle(e("eating", at(18, 45), { method: "meal", meal_type: "dinner", portion_pct: 50, food_ids: ["pasta", "carrots"] }), child)).toBe("Dinner · ate half");
    expect(entryDetail(e("eating", at(18, 45), { method: "meal", meal_type: "dinner", portion_pct: 50, food_ids: ["pasta", "carrots"] }))).toBe("Pasta, carrots");
    expect(entryTitle(e("medication", at(18), { medication_id: "ibu", outcome: "given", dose: 7.5, unit: "mL", prn_reason: "fever" }), child)).toBe("Ibuprofen · given");
    expect(entryDetail(e("medication", at(18), { medication_id: "ibu", outcome: "given", dose: 7.5, unit: "mL", prn_reason: "fever" }))).toBe("7.5 mL · as needed, fever");
    expect(entryTitle(e("mood", at(17, 30), { scope: "moment", level: 2, behaviors: [{ key: "meltdown", severity: "moderate" }] }), child)).toBe("Upset · meltdown");
    expect(entryTitle(e("activity", at(16, 15), { activity_id: "playground", enjoyment: 5, duration_min: 30 }), child)).toBe("Playground · loved it");
  });

  it("uses diaper wording for baby profiles (Appendix A)", () => {
    expect(entryTitle(e("bathroom", at(19), { kind: "pee", location: "diaper" }), baby)).toBe("Wet diaper");
    expect(tileStatus(e("bathroom", new Date().toISOString(), { kind: "pee", location: "diaper" }), baby)).toBe("Wet · just now");
  });
});

describe("caregiver label", () => {
  it("uses initials when the name is longer than 8 characters", () => {
    expect(caregiverLabel("Grandma", "GR")).toBe("Grandma");
    expect(caregiverLabel("Aunt Rosalind", "AR")).toBe("AR");
  });
});
