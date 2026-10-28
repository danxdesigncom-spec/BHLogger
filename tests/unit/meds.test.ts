import { describe, it, expect } from "vitest";
import {
  adherence, duplicateCheck, formatElapsed, slotStatus, slotToFill, slotsForDay, todaySlots, type DoseLike, type MedLike,
} from "@/lib/meds/schedule";

const ibuprofen: MedLike = {
  id: "ibu", name: "Ibuprofen", kind: "prn", schedule: null, dose_window_min: 60, min_interval_hours: 6,
  start_date: null, end_date: null, active: true,
};
const melatonin: MedLike = {
  id: "mel", name: "Melatonin", kind: "scheduled", schedule: { times: ["20:00"], days: [0, 1, 2, 3, 4, 5, 6] },
  dose_window_min: 60, min_interval_hours: null, start_date: null, end_date: null, active: true,
};

const at = (h: number, m = 0, day = 26) => new Date(2026, 9, day, h, m);
let n = 0;
const dose = (med: string, when: Date, outcome = "given", scheduledFor: Date | null = null, by = "Dad"): DoseLike => ({
  id: `d${n++}`, occurred_at: when.toISOString(), logged_by_name: by, deleted_at: null,
  data: { medication_id: med, dose: 1, unit: "mL", outcome, scheduled_for: scheduledFor?.toISOString() ?? null },
});

describe("AT-04 duplicate-dose guard", () => {
  it("warns when Ibuprofen (6 h minimum) was given 1 h ago by Dad", () => {
    const c = duplicateCheck(ibuprofen, [dose("ibu", at(17, 0))], at(18, 0), null);
    expect(c?.reason).toBe("interval");
    expect(c?.elapsedMin).toBe(60);
    expect(c?.dose.logged_by_name).toBe("Dad");
  });

  it("allows a dose after the interval has passed", () => {
    expect(duplicateCheck(ibuprofen, [dose("ibu", at(11, 0))], at(18, 0), null)).toBeNull();
  });

  it("uses 60 minutes when no interval is set", () => {
    const med = { ...ibuprofen, min_interval_hours: null };
    expect(duplicateCheck(med, [dose("ibu", at(17, 30))], at(18, 0), null)).not.toBeNull();
    expect(duplicateCheck(med, [dose("ibu", at(16, 30))], at(18, 0), null)).toBeNull();
  });

  it("ignores refused doses and other medications", () => {
    expect(duplicateCheck(ibuprofen, [dose("ibu", at(17, 30), "refused"), dose("other", at(17, 30))], at(18, 0), null)).toBeNull();
  });

  it("warns when the scheduled slot is already marked given", () => {
    const c = duplicateCheck(melatonin, [dose("mel", at(19, 5), "given", at(20))], at(23, 30), at(20));
    expect(c?.reason).toBe("slot");
  });
});

describe("AT-05 dose not logged", () => {
  it("reads Not logged once the ±60 min window has passed", () => {
    expect(slotStatus(melatonin, at(20), [], at(21, 1)).state).toBe("not_logged");
  });

  it("is due inside the window and upcoming before it", () => {
    expect(slotStatus(melatonin, at(20), [], at(19, 30)).state).toBe("due");
    expect(slotStatus(melatonin, at(20), [], at(18, 0)).state).toBe("upcoming");
  });

  it("marks the slot Given when it's logged late at 8:45 PM", () => {
    const now = at(21, 1);
    expect(slotToFill(melatonin, [], now)?.getTime()).toBe(at(20).getTime());
    const late = dose("mel", at(20, 45), "given", at(20));
    expect(todaySlots(melatonin, [late], now)[0].state).toBe("given");
  });
});

describe("MED-10 adherence", () => {
  it("counts given and partial over scheduled slots, excluding open windows", () => {
    const doses = [
      dose("mel", at(20, 0, 20), "given", at(20, 0, 20)),
      dose("mel", at(20, 0, 21), "partial", at(20, 0, 21)),
      dose("mel", at(20, 0, 22), "refused", at(20, 0, 22)),
      dose("mel", at(20, 0, 23), "skipped", at(20, 0, 23)),
    ];
    const a = adherence(melatonin, doses, at(0, 0, 20), at(23, 59, 25), at(20, 30, 25));
    // Oct 20–24 are closed (5 slots); Oct 25's 8 PM slot is still inside its window.
    expect(a.scheduled).toBe(5);
    expect(a.given + a.partial).toBe(2);
    expect(a.notLogged).toBe(1);
    expect(a.pct).toBe(40);
  });
});

describe("schedule helpers", () => {
  it("respects weekday and date limits", () => {
    const weekdays = { ...melatonin, schedule: { times: ["08:00"], days: [1, 2, 3, 4, 5] } };
    expect(slotsForDay(weekdays, new Date(2026, 9, 25))).toHaveLength(0); // Sunday
    expect(slotsForDay(weekdays, new Date(2026, 9, 26))).toHaveLength(1); // Monday
    expect(slotsForDay({ ...melatonin, end_date: "2026-10-25" }, new Date(2026, 9, 26))).toHaveLength(0);
  });

  it("formats elapsed time like the S08 copy", () => {
    expect(formatElapsed(65)).toBe("1 h 5 min");
    expect(formatElapsed(45)).toBe("45 min");
    expect(formatElapsed(120)).toBe("2 h");
  });
});
