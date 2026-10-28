import { describe, expect, it } from "vitest";
import { parseTemplate, sameTemplate, templateFromEntry } from "@/lib/favorites";
import { moveTile, orderTiles, TILE_ORDER, wideTiles } from "@/lib/home/tiles";
import { formatTimer, timerMinutes } from "@/lib/timers";
import { favoriteLabel, type SummaryContext } from "@/lib/entries/summary";

const child: SummaryContext = { careStage: "child", toileting: "toilet", volumeUnit: "oz" };
const baby: SummaryContext = { careStage: "baby", toileting: "diapers", volumeUnit: "oz" };

describe("QL-09 quick tap templates", () => {
  it("keeps the entry's type and data", () => {
    const tpl = templateFromEntry({ type: "bathroom", data: { kind: "pee", location: "toilet", flags: [] } });
    expect(tpl).toEqual({ type: "bathroom", data: { kind: "pee", location: "toilet", flags: [] } });
  });

  it("drops the moment-specific parts of a dose and logs it as given", () => {
    const tpl = templateFromEntry({
      type: "medication",
      data: { medication_id: "m1", dose: 5, unit: "mL", outcome: "refused", scheduled_for: "2026-10-26T08:00:00Z", duplicate_override: true, followup: "helped", prn_reason: null },
    });
    expect(tpl?.data).toMatchObject({ outcome: "given", scheduled_for: null, duplicate_override: false, followup: null, dose: 5 });
  });

  it("turns a day-level mood into a moment", () => {
    expect(templateFromEntry({ type: "mood", data: { scope: "day", level: 4 } })?.data.scope).toBe("moment");
  });

  it("skips types that have no quick tap", () => {
    expect(templateFromEntry({ type: "sleep", data: {} })).toBeNull();
  });

  it("compares templates regardless of key order", () => {
    expect(sameTemplate({ type: "eating", data: { method: "bottle", amount_ml: 120 } }, { type: "eating", data: { amount_ml: 120, method: "bottle" } })).toBe(true);
    expect(sameTemplate({ type: "eating", data: { method: "bottle", amount_ml: 120 } }, { type: "eating", data: { method: "bottle", amount_ml: 90 } })).toBe(false);
  });

  it("parses stored templates and rejects malformed ones", () => {
    expect(parseTemplate({ type: "bathroom", data: { kind: "pee" } })).toEqual({ type: "bathroom", data: { kind: "pee" } });
    expect(parseTemplate({ type: "bathroom" })).toBeNull();
    expect(parseTemplate(null)).toBeNull();
  });

  it("labels a new quick tap in the profile's own wording", () => {
    expect(favoriteLabel({ type: "bathroom", data: { kind: "pee" } }, child)).toBe("Pee");
    expect(favoriteLabel({ type: "bathroom", data: { kind: "pee" } }, baby)).toBe("Wet diaper");
    expect(favoriteLabel({ type: "eating", data: { method: "bottle", amount_ml: 120 } }, baby)).toBe("4 oz bottle");
  });
});

describe("QL-12 tile order", () => {
  it("falls back to the default order", () => {
    expect(orderTiles(undefined)).toEqual([...TILE_ORDER]);
    expect(orderTiles("nonsense")).toEqual([...TILE_ORDER]);
  });

  it("keeps the saved order, drops unknown or repeated modules, and appends missing ones", () => {
    expect(orderTiles(["mood", "sleep", "mood", "bathroom"])).toEqual(["mood", "bathroom", "eating", "activity", "medication"]);
  });

  it("moves a tile one step and stops at the ends", () => {
    const order = orderTiles(undefined);
    expect(moveTile(order, "eating", -1)).toEqual(["eating", "bathroom", "mood", "activity", "medication"]);
    expect(moveTile(order, "bathroom", -1)).toEqual(order);
    expect(moveTile(order, "medication", 1)).toEqual(order);
  });

  it("widens a tile left alone before the full-width Medication row", () => {
    expect([...wideTiles(["bathroom", "eating", "mood", "activity", "medication"])]).toEqual(["medication"]);
    expect(wideTiles(["bathroom", "medication", "eating", "mood"]).has("bathroom")).toBe(true);
    expect(wideTiles(["bathroom", "eating", "mood", "medication", "activity"]).has("mood")).toBe(true);
  });
});

describe("QL-11 timers", () => {
  it("stores whole minutes, at least 1", () => {
    const start = "2026-10-26T19:00:00.000Z";
    expect(timerMinutes(start, new Date("2026-10-26T19:00:20.000Z"))).toBe(1);
    expect(timerMinutes(start, new Date("2026-10-26T19:14:40.000Z"))).toBe(15);
    expect(timerMinutes(start, new Date("2026-10-26T20:30:00.000Z"))).toBe(90);
  });

  it("formats the running time", () => {
    expect(formatTimer(0)).toBe("0:00");
    expect(formatTimer(65_000)).toBe("1:05");
    expect(formatTimer(3_725_000)).toBe("1:02:05");
  });
});
