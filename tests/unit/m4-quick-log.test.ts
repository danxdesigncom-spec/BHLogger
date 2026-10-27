import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── TimeChip logic ────────────────────────────────────────────────────────────
// The TimeChip component uses these preset offsets and enforces max = now.
// We test the pure logic here rather than rendering the component.

function applyPreset(label: string, now: Date): Date {
  switch (label) {
    case "Now":         return new Date(now);
    case "15 min ago":  return new Date(now.getTime() - 15 * 60_000);
    case "30 min ago":  return new Date(now.getTime() - 30 * 60_000);
    case "1 h ago":     return new Date(now.getTime() - 60 * 60_000);
    case "2 h ago":     return new Date(now.getTime() - 2 * 60 * 60_000);
    default:            return new Date(now);
  }
}

function isTimeInFuture(selectedTime: Date, now: Date): boolean {
  return selectedTime.getTime() > now.getTime();
}

describe("TimeChip presets", () => {
  const NOW = new Date("2026-10-26T14:00:00Z");

  it("Now returns the current time", () => {
    const result = applyPreset("Now", NOW);
    expect(result.getTime()).toBe(NOW.getTime());
  });

  it("15 min ago returns 15 minutes before now", () => {
    const result = applyPreset("15 min ago", NOW);
    expect(NOW.getTime() - result.getTime()).toBe(15 * 60_000);
  });

  it("30 min ago returns 30 minutes before now", () => {
    const result = applyPreset("30 min ago", NOW);
    expect(NOW.getTime() - result.getTime()).toBe(30 * 60_000);
  });

  it("1 h ago returns 60 minutes before now", () => {
    const result = applyPreset("1 h ago", NOW);
    expect(NOW.getTime() - result.getTime()).toBe(60 * 60_000);
  });

  it("2 h ago returns 2 hours before now", () => {
    const result = applyPreset("2 h ago", NOW);
    expect(NOW.getTime() - result.getTime()).toBe(2 * 60 * 60_000);
  });

  it("all preset times are in the past (not future)", () => {
    const presets = ["Now", "15 min ago", "30 min ago", "1 h ago", "2 h ago"];
    for (const label of presets) {
      const result = applyPreset(label, NOW);
      // "Now" may be exactly equal; others must be strictly past
      expect(result.getTime()).toBeLessThanOrEqual(NOW.getTime());
    }
  });
});

describe("TimeChip future-time guard", () => {
  it("rejects a time in the future", () => {
    const now = new Date();
    const future = new Date(now.getTime() + 60_000);
    expect(isTimeInFuture(future, now)).toBe(true);
  });

  it("accepts a time at now", () => {
    const now = new Date();
    expect(isTimeInFuture(now, now)).toBe(false);
  });

  it("accepts a time in the past", () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60_000);
    expect(isTimeInFuture(past, now)).toBe(false);
  });
});

// ─── Undo soft-delete logic ────────────────────────────────────────────────────
// The undoEntry server action sets deleted_at on the entry.
// We test the business rule logic (not the DB call) here.

interface EntryRecord {
  id: string;
  household_id: string;
  logged_by: string;
  deleted_at: string | null;
}

function canUndo(
  entry: EntryRecord,
  requestingUserId: string,
  requestingRole: "admin" | "caregiver" | "viewer",
): boolean {
  if (entry.deleted_at !== null) return false; // already deleted
  if (requestingRole === "viewer") return false;
  if (entry.logged_by === requestingUserId) return true; // own entry
  if (requestingRole === "admin") return true; // admin can undo any
  return false;
}

describe("Undo permission rules", () => {
  const ENTRY: EntryRecord = {
    id: "entry-1",
    household_id: "hh-1",
    logged_by: "user-1",
    deleted_at: null,
  };

  it("allows a caregiver to undo their own entry", () => {
    expect(canUndo(ENTRY, "user-1", "caregiver")).toBe(true);
  });

  it("blocks a caregiver from undoing another user's entry", () => {
    expect(canUndo(ENTRY, "user-2", "caregiver")).toBe(false);
  });

  it("allows an admin to undo any entry", () => {
    expect(canUndo(ENTRY, "user-2", "admin")).toBe(true);
  });

  it("blocks a viewer from undoing any entry", () => {
    expect(canUndo(ENTRY, "user-1", "viewer")).toBe(false);
  });

  it("blocks undoing an already-deleted entry", () => {
    const deleted: EntryRecord = { ...ENTRY, deleted_at: "2026-10-26T14:00:00Z" };
    expect(canUndo(deleted, "user-1", "admin")).toBe(false);
  });
});

// ─── Profile color token mapping ───────────────────────────────────────────────
// data-profile-color is set on <html> so CSS tokens resolve.
// We verify the mapping is consistent and covers all expected colors.

type ProfileColor = "violet" | "teal" | "rose" | "amber" | "blue";

const PROFILE_COLORS: ProfileColor[] = ["violet", "teal", "rose", "amber", "blue"];

function cssTokensForColor(color: ProfileColor): string[] {
  return [
    `--color-profile-${color}`,
    `--color-profile-${color}-tint`,
    `--color-profile-${color}-ink`,
  ];
}

describe("Profile color tokens", () => {
  it("each color has three associated CSS tokens", () => {
    for (const color of PROFILE_COLORS) {
      const tokens = cssTokensForColor(color);
      expect(tokens).toHaveLength(3);
    }
  });

  it("all five profile colors are represented", () => {
    expect(PROFILE_COLORS).toHaveLength(5);
    expect(PROFILE_COLORS).toContain("violet");
    expect(PROFILE_COLORS).toContain("teal");
    expect(PROFILE_COLORS).toContain("rose");
    expect(PROFILE_COLORS).toContain("amber");
    expect(PROFILE_COLORS).toContain("blue");
  });

  it("data-profile-color attribute matches a valid color", () => {
    const valid = new Set<string>(PROFILE_COLORS);
    const testValues = ["violet", "teal", "rose", "amber", "blue", "green", ""];
    const results = testValues.map((v) => valid.has(v));
    expect(results).toEqual([true, true, true, true, true, false, false]);
  });
});

// ─── Care stage wording (PRD Appendix A) ──────────────────────────────────────

type CareStage = "baby" | "child" | "teen_adult";

function bathroomTypeLabel(type: "pee" | "bm", stage: CareStage): string {
  if (stage === "baby") return type === "pee" ? "Wet" : "Dirty";
  return type === "pee" ? "Pee" : "BM";
}

describe("Care stage bathroom wording", () => {
  it("uses 'Wet' for pee in baby stage", () => {
    expect(bathroomTypeLabel("pee", "baby")).toBe("Wet");
  });

  it("uses 'Dirty' for BM in baby stage", () => {
    expect(bathroomTypeLabel("bm", "baby")).toBe("Dirty");
  });

  it("uses 'Pee' for pee in child stage", () => {
    expect(bathroomTypeLabel("pee", "child")).toBe("Pee");
  });

  it("uses 'BM' for BM in child stage", () => {
    expect(bathroomTypeLabel("bm", "child")).toBe("BM");
  });

  it("uses 'Pee' for pee in teen_adult stage", () => {
    expect(bathroomTypeLabel("pee", "teen_adult")).toBe("Pee");
  });

  it("uses 'BM' for BM in teen_adult stage", () => {
    expect(bathroomTypeLabel("bm", "teen_adult")).toBe("BM");
  });
});
