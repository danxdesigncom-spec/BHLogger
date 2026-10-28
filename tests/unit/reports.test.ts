import { describe, it, expect } from "vitest";
import { csvCell, entriesToCsv, localTimestamp } from "@/lib/reports/csv";
import { flaggedEvents } from "@/lib/reports/flagged";

const base = { tz: "America/Chicago", note: null, flagged_for_doctor: false, logged_by_name: "Mom", profile_id: "leo", deleted_at: null };

describe("RPT-04 CSV", () => {
  it("writes one row per entry with UTC and local timestamps and flattened fields", () => {
    const csv = entriesToCsv(
      [
        { ...base, id: "a", type: "bathroom", occurred_at: "2026-10-26T22:30:00.000Z", data: { kind: "bm", scale: "bristol", consistency: 4, flags: ["straining_pain"] } },
        { ...base, id: "b", type: "mood", occurred_at: "2026-10-26T23:00:00.000Z", data: { level: 2, behaviors: [{ key: "meltdown", severity: "moderate" }] }, note: 'Said "no", then cried' },
      ],
      () => "Leo",
    );
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("entry_id,profile,module,occurred_at_utc,occurred_at_local,time_zone,logged_by,flagged_for_doctor,note,behaviors,consistency,flags,kind,level,scale");
    expect(lines[1]).toContain("2026-10-26 17:30:00");
    expect(lines[1]).toContain(",4,straining_pain,bm,,bristol");
    expect(lines[2]).toContain('"Said ""no"", then cried"');
    expect(lines[2]).toContain("meltdown moderate");
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-2")).toBe("'-2");
  });

  it("formats local time in the entry's zone", () => {
    expect(localTimestamp("2026-10-27T03:00:00Z", "America/Chicago")).toBe("2026-10-26 22:00:00");
  });
});

describe("RPT-02 flagged events", () => {
  const opts = { from: new Date(2026, 9, 20), to: new Date(2026, 9, 26, 23), bmAlertDays: 3, medName: () => "Ibuprofen", describe: () => "Entry" };
  const e = (id: string, type: string, iso: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ ...base, id, type, occurred_at: iso, data, ...extra });

  it("collects flagged entries, pale stool, reactions, severe behaviors and refused doses", () => {
    const events = flaggedEvents(
      [
        e("1", "bathroom", "2026-10-20T15:00:00Z", { kind: "bm", color: "white_pale_clay" }),
        e("2", "eating", "2026-10-21T23:00:00Z", { method: "meal", reactions: ["gagged"] }),
        e("3", "mood", "2026-10-22T22:30:00Z", { level: 1, behaviors: [{ key: "meltdown", severity: "severe" }] }),
        e("4", "medication", "2026-10-23T14:00:00Z", { medication_id: "x", dose: 7.5, unit: "mL", outcome: "refused" }),
        e("5", "mood", "2026-10-23T18:00:00Z", { level: 3 }, { flagged_for_doctor: true, note: "Ask about sleep" }),
        e("6", "mood", "2026-10-23T19:00:00Z", { level: 4 }),
      ],
      opts,
    );
    const whats = events.map((x) => x.what);
    expect(whats).toContain("Pale stool");
    expect(whats).toContain("Reaction: gagged");
    expect(whats).toContain("Meltdown, severe");
    expect(whats).toContain("Ibuprofen 7.5 mL refused");
    expect(whats).toContain("Entry. Ask about sleep");
    expect(whats.some((w) => w.startsWith("No BM for"))).toBe(true);
  });
});
