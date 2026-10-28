import { describe, it, expect } from "vitest";
import { generateHouseholdData, SEED_IDS, storyAnchor } from "@/lib/demo/generate";
import { EntrySchema } from "@/lib/schemas/entry";

const anchor = storyAnchor();
const data = generateHouseholdData({ anchor, tz: "America/Chicago" });

describe("demo data generator", () => {
  it("produces only entries that pass the canonical Zod schemas", () => {
    const failures = data.entries
      .map((e) => ({ e, r: EntrySchema.safeParse(e) }))
      .filter(({ r }) => !r.success)
      .slice(0, 3)
      .map(({ e, r }) => ({ type: e.type, data: e.data, issue: r.error?.issues[0] }));
    expect(failures).toEqual([]);
  });

  it("is deterministic", () => {
    const again = generateHouseholdData({ anchor, tz: "America/Chicago" });
    expect(again.entries.map((e) => e.id)).toEqual(data.entries.map((e) => e.id));
  });

  it("never writes entries after the anchor", () => {
    expect(data.entries.every((e) => new Date(e.occurred_at) <= anchor)).toBe(true);
  });

  it("leaves Leo 3 days without a BM (AT-10 story)", () => {
    const lastBm = data.entries
      .filter((e) => e.profile_id === SEED_IDS.leo && e.type === "bathroom")
      .filter((e) => ["bm", "both"].includes((e.data as { kind: string }).kind))
      .at(-1)!;
    const days = (anchor.getTime() - new Date(lastBm.occurred_at).getTime()) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(3);
    expect(days).toBeLessThan(4);
  });

  it("records the Melatonin dose change 25 days before the anchor (AT-12)", () => {
    const change = data.medicationChanges.find((c) => c.medication_id === SEED_IDS.leoMelatonin && c.change_type === "dose_changed");
    expect(change?.effective_at).toBe("2026-10-01");
  });

  it("shows 2 of 3 scheduled doses given for Leo today", () => {
    const today = data.entries.filter(
      (e) => e.profile_id === SEED_IDS.leo && e.type === "medication" && e.occurred_at >= new Date(2026, 9, 26).toISOString(),
    );
    const scheduled = today.filter((e) => (e.data as { scheduled_for: string | null }).scheduled_for);
    expect(scheduled).toHaveLength(2);
  });
});
