import { describe, it, expect } from "vitest";

// ─── Bristol stool scale helpers ──────────────────────────────────────────────

function bristolLabel(type: number): string {
  const labels = ["Hard lumps", "Lumpy", "Cracked", "Smooth", "Soft blobs", "Mushy", "Watery"];
  return labels[type - 1] ?? "";
}

describe("Bristol stool scale", () => {
  it("has 7 types", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(bristolLabel)).toHaveLength(7);
  });

  it("type 4 is Smooth (ideal)", () => {
    expect(bristolLabel(4)).toBe("Smooth");
  });

  it("type 1 is Hard lumps (constipation end)", () => {
    expect(bristolLabel(1)).toBe("Hard lumps");
  });

  it("type 7 is Watery (diarrhea end)", () => {
    expect(bristolLabel(7)).toBe("Watery");
  });
});

// ─── Infant stool scale helpers ───────────────────────────────────────────────

type InfantConsistency = "watery" | "soft" | "formed" | "hard";
const INFANT_ORDER: InfantConsistency[] = ["watery", "soft", "formed", "hard"];

describe("Infant stool scale", () => {
  it("has 4 points", () => {
    expect(INFANT_ORDER).toHaveLength(4);
  });

  it("watery is the first (loosest)", () => {
    expect(INFANT_ORDER[0]).toBe("watery");
  });

  it("hard is the last (firmest)", () => {
    expect(INFANT_ORDER[3]).toBe("hard");
  });
});

// ─── Care-stage routing ───────────────────────────────────────────────────────

type CareStage = "baby" | "child" | "teen_adult";

function bathroomLabel(type: string, stage: CareStage): string {
  if (stage === "baby") {
    if (type === "wet")   return "Wet";
    if (type === "dirty") return "Dirty";
    if (type === "both")  return "Both";
    if (type === "dry")   return "Dry";
  } else {
    if (type === "pee")  return "Pee";
    if (type === "bm")   return "BM";
    if (type === "both") return "Both";
  }
  return "";
}

describe("Care-stage wording", () => {
  it("baby/diaper uses Wet not Pee", () => {
    expect(bathroomLabel("wet", "baby")).toBe("Wet");
    expect(bathroomLabel("pee", "baby")).toBe("");
  });

  it("child uses Pee not Wet", () => {
    expect(bathroomLabel("pee", "child")).toBe("Pee");
    expect(bathroomLabel("wet", "child")).toBe("");
  });

  it("baby has Dry option", () => {
    expect(bathroomLabel("dry", "baby")).toBe("Dry");
  });

  it("non-baby has BM option", () => {
    expect(bathroomLabel("bm", "teen_adult")).toBe("BM");
  });
});

// ─── BTH-06: calm notice trigger ─────────────────────────────────────────────

type StoolColor = "yellow" | "green" | "brown" | "black" | "red" | "pale" | "other";
const CALM_COLORS = new Set<StoolColor>(["red", "black", "pale"]);

function shouldShowCalmNotice(color: StoolColor): boolean {
  return CALM_COLORS.has(color);
}

describe("BTH-06 calm notice", () => {
  it("shows for red stool", () => {
    expect(shouldShowCalmNotice("red")).toBe(true);
  });

  it("shows for black stool", () => {
    expect(shouldShowCalmNotice("black")).toBe(true);
  });

  it("shows for pale stool", () => {
    expect(shouldShowCalmNotice("pale")).toBe(true);
  });

  it("does NOT show for yellow stool", () => {
    expect(shouldShowCalmNotice("yellow")).toBe(false);
  });

  it("does NOT show for brown stool", () => {
    expect(shouldShowCalmNotice("brown")).toBe(false);
  });

  it("does NOT show for other", () => {
    expect(shouldShowCalmNotice("other")).toBe(false);
  });
});

// ─── EAT-06: urgent reaction trigger ─────────────────────────────────────────

const URGENT_REACTIONS = new Set(["Trouble breathing", "Swelling", "Hives", "Vomiting"]);

function hasUrgentReaction(selected: string[]): boolean {
  return selected.some((r) => URGENT_REACTIONS.has(r));
}

describe("EAT-06 urgent notice", () => {
  it("triggers on trouble breathing", () => {
    expect(hasUrgentReaction(["Trouble breathing"])).toBe(true);
  });

  it("triggers on swelling", () => {
    expect(hasUrgentReaction(["Swelling"])).toBe(true);
  });

  it("does not trigger on ordinary reactions", () => {
    expect(hasUrgentReaction(["Tired"])).toBe(false);
  });

  it("triggers when one of several reactions is urgent", () => {
    expect(hasUrgentReaction(["Tired", "Hives"])).toBe(true);
  });
});

// ─── Portion plate percentage ─────────────────────────────────────────────────

type Portion = 0 | 25 | 50 | 75 | 100;
const PORTION_LABELS: Record<Portion, string> = {
  0: "None", 25: "A little", 50: "Half", 75: "Most", 100: "All",
};

describe("Portion plate labels", () => {
  it("0% is None", () => { expect(PORTION_LABELS[0]).toBe("None"); });
  it("50% is Half", () => { expect(PORTION_LABELS[50]).toBe("Half"); });
  it("100% is All", () => { expect(PORTION_LABELS[100]).toBe("All"); });
});

// ─── Volume conversion (EAT / Feeding) ───────────────────────────────────────

const OZ_TO_ML = 29.574;

function ozToMl(oz: number): number {
  return Math.round(oz * OZ_TO_ML);
}

function mlToOz(ml: number): number {
  return Math.round((ml / OZ_TO_ML) * 2) / 2; // round to nearest 0.5
}

describe("oz ↔ ml conversion", () => {
  it("4 oz → ~118 ml", () => {
    expect(ozToMl(4)).toBe(118);
  });

  it("118 ml → 4 oz (round trip)", () => {
    expect(mlToOz(118)).toBe(4);
  });

  it("1 oz → 30 ml (rounded)", () => {
    expect(ozToMl(1)).toBe(30);
  });

  it("rounds ml→oz to nearest 0.5", () => {
    expect(mlToOz(100)).toBe(3.5); // 100/29.574 ≈ 3.38, rounds to 3.5
  });
});
