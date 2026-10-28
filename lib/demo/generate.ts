// Deterministic generator for the Rodriguez Family story (Leo + Maya).
// Used by scripts/seed.ts (dev database) and by demo mode (IndexedDB), so both show the same data.

import type { Database, Json } from "@/lib/supabase/types";

type Tables = Database["public"]["Tables"];
export type EntryRow = Tables["entries"]["Row"];
export type MedicationRow = Tables["medications"]["Row"];
export type MedicationChangeRow = Tables["medication_changes"]["Row"];
export type AppointmentRow = Tables["appointments"]["Row"];
export type ProfileRow = Tables["profiles"]["Row"];
export type HouseholdRow = Tables["households"]["Row"];
export type MemberRow = Tables["household_members"]["Row"];
export type OptionRow = Tables["option_lists"]["Row"];
export type FavoriteRow = Tables["favorites"]["Row"];

export const SEED_IDS = {
  household:     "a1000000-0000-0000-0000-000000000001",
  mom:           "a1000000-0000-0000-0000-000000000002",
  dad:           "a1000000-0000-0000-0000-000000000003",
  grandma:       "a1000000-0000-0000-0000-000000000004",
  momMember:     "a1000000-0000-0000-0000-000000000005",
  dadMember:     "a1000000-0000-0000-0000-000000000006",
  grandmaMember: "a1000000-0000-0000-0000-000000000007",
  leo:           "a1000000-0000-0000-0000-000000000008",
  maya:          "a1000000-0000-0000-0000-000000000009",
  leoAllergy:    "a1000000-0000-0000-0000-000000000010",
  leoFiber:      "a1000000-0000-0000-0000-000000000011",
  leoMelatonin:  "a1000000-0000-0000-0000-000000000012",
  leoIbuprofen:  "a1000000-0000-0000-0000-000000000013",
  mayaVitaminD:  "a1000000-0000-0000-0000-000000000014",
};
export type SeedIds = typeof SEED_IDS;

export interface GeneratedData {
  household: HouseholdRow;
  members: MemberRow[];
  profiles: ProfileRow[];
  medications: MedicationRow[];
  medicationChanges: MedicationChangeRow[];
  entries: EntryRow[];
  appointments: AppointmentRow[];
  options: OptionRow[];
  favorites: FavoriteRow[];
}

export interface GenerateOptions {
  /** The story's "now". Entries end here; Melatonin is due 25 minutes later. */
  anchor: Date;
  tz: string;
  days?: number;
  seed?: number;
  ids?: Partial<SeedIds>;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function generateHouseholdData(opts: GenerateOptions): GeneratedData {
  const ids = { ...SEED_IDS, ...opts.ids };
  const days = opts.days ?? 60;
  const rand = mulberry32(opts.seed ?? 20261026);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const chance = (p: number) => rand() < p;
  const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));
  const uuid = () => {
    const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
    h[12] = "4";
    h[16] = "89ab"[Math.floor(rand() * 4)];
    const s = h.join("");
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  };

  const anchor = opts.anchor;
  const startOfAnchorDay = new Date(anchor);
  startOfAnchorDay.setHours(0, 0, 0, 0);
  const dayStart = (daysAgo: number) => {
    const d = new Date(startOfAnchorDay);
    d.setDate(d.getDate() - daysAgo);
    return d;
  };
  const at = (day: Date, h: number, m = 0) => {
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const yearsBefore = (years: number, months = 0) => {
    const d = new Date(startOfAnchorDay);
    d.setFullYear(d.getFullYear() - years);
    d.setMonth(d.getMonth() - months);
    return ymd(d);
  };
  const created = iso(dayStart(days + 30));

  // ─── Household, members, profiles ──────────────────────────────────────────
  const household: HouseholdRow = {
    id: ids.household,
    name: "Rodriguez Family",
    settings: { volume_unit: "oz", time_format: "12h", week_start: "sunday", locale: "en" },
    created_at: created,
    updated_at: created,
  } as HouseholdRow;

  const cg = {
    mom:     { id: ids.mom,     name: "Mom",     initials: "MR" },
    dad:     { id: ids.dad,     name: "Dad",     initials: "DR" },
    grandma: { id: ids.grandma, name: "Grandma", initials: "GR" },
  };
  type Caregiver = (typeof cg)[keyof typeof cg];
  const anyCaregiver = (): Caregiver => {
    const r = rand();
    return r < 0.55 ? cg.mom : r < 0.85 ? cg.dad : cg.grandma;
  };

  const members: MemberRow[] = [
    { id: ids.momMember,     household_id: ids.household, user_id: ids.mom,     role: "admin",     display_name: "Mom",     initials: "MR", access_from: null, created_at: created },
    { id: ids.dadMember,     household_id: ids.household, user_id: ids.dad,     role: "caregiver", display_name: "Dad",     initials: "DR", access_from: null, created_at: created },
    { id: ids.grandmaMember, household_id: ids.household, user_id: ids.grandma, role: "caregiver", display_name: "Grandma", initials: "GR", access_from: null, created_at: created },
  ] as MemberRow[];

  const profiles: ProfileRow[] = [
    {
      id: ids.leo, household_id: ids.household, name: "Leo", color: "violet", avatar: null,
      dob: yearsBefore(6), care_stage: "child", toileting: "toilet",
      feeding_methods: ["meal", "snack", "drink"],
      enabled_modules: ["bathroom", "eating", "activity", "mood", "medication"],
      settings: { bm_alert_days: 3, wet_diaper_min: null, med_dose_window_min: 60, med_duplicate_window_min: 60 },
      care_card: {
        allergies: ["Peanuts"],
        conditions: ["Mild asthma", "Autism (level 1)"],
        communication_notes: "Uses short sentences. Give a 5-minute warning before transitions.",
        calming_strategies: ["Weighted blanket", "Counting to 10 together", "Quiet corner with books"],
        emergency_contacts: [{ name: "Mom", relationship: "Parent", phone: "312-555-0101" }],
        doctor: { name: "Dr. Chen", phone: "312-555-0100" },
      },
      archived_at: null, created_at: created, updated_at: created,
    },
    {
      id: ids.maya, household_id: ids.household, name: "Maya", color: "teal", avatar: null,
      dob: yearsBefore(0, 7), care_stage: "baby", toileting: "diapers",
      feeding_methods: ["breast", "bottle", "meal"],
      enabled_modules: ["bathroom", "eating", "activity", "mood", "medication"],
      settings: { bm_alert_days: 2, wet_diaper_min: null, med_dose_window_min: 60, med_duplicate_window_min: 60 },
      care_card: {
        allergies: [],
        conditions: [],
        calming_strategies: ["Rocking", "White noise"],
        emergency_contacts: [{ name: "Mom", relationship: "Parent", phone: "312-555-0101" }],
        doctor: { name: "Dr. Patel", phone: "312-555-0200" },
      },
      archived_at: null, created_at: created, updated_at: created,
    },
  ] as ProfileRow[];

  // ─── Medications and change history ────────────────────────────────────────
  const medBase = { household_id: ids.household, purpose: null, prescriber: null, instructions: null, end_date: null, active: true, created_at: created, updated_at: created };
  const started = ymd(dayStart(days + 30));
  const melatoninChange = dayStart(25);

  const medications: MedicationRow[] = [
    { ...medBase, id: ids.leoAllergy, profile_id: ids.leo, name: "Allergy relief", form: "Liquid", strength: "1 mg/mL",
      default_dose: 5, dose_unit: "mL", kind: "scheduled", schedule: { times: ["08:00"], days: [0, 1, 2, 3, 4, 5, 6] },
      dose_window_min: 60, min_interval_hours: 20, purpose: "Seasonal allergies", prescriber: "Dr. Chen", start_date: started },
    { ...medBase, id: ids.leoFiber, profile_id: ids.leo, name: "Fiber gummy", form: "Chewable", strength: null,
      default_dose: 1, dose_unit: "gummy", kind: "scheduled", schedule: { times: ["12:00"], days: [0, 1, 2, 3, 4, 5, 6] },
      dose_window_min: 60, min_interval_hours: null, purpose: "Constipation", start_date: started },
    { ...medBase, id: ids.leoMelatonin, profile_id: ids.leo, name: "Melatonin", form: "Chewable", strength: "1 mg",
      default_dose: 1, dose_unit: "mg", kind: "scheduled", schedule: { times: ["19:30"], days: [0, 1, 2, 3, 4, 5, 6] },
      dose_window_min: 60, min_interval_hours: 12, purpose: "Sleep", prescriber: "Dr. Chen", start_date: started },
    { ...medBase, id: ids.leoIbuprofen, profile_id: ids.leo, name: "Ibuprofen (children's)", form: "Liquid", strength: "100 mg/5 mL",
      default_dose: 7.5, dose_unit: "mL", kind: "prn", schedule: null,
      dose_window_min: 60, min_interval_hours: 6, purpose: "Fever or pain", instructions: "Every 6 to 8 hours as needed", start_date: started },
    { ...medBase, id: ids.mayaVitaminD, profile_id: ids.maya, name: "Vitamin D", form: "Drops", strength: "400 IU/drop",
      default_dose: 1, dose_unit: "drop", kind: "scheduled", schedule: { times: ["09:00"], days: [0, 1, 2, 3, 4, 5, 6] },
      dose_window_min: 60, min_interval_hours: 20, purpose: "Supplement", prescriber: "Dr. Patel", start_date: started },
  ] as MedicationRow[];

  const change = (medicationId: string, type: MedicationChangeRow["change_type"], effective: string, before: Json, after: Json): MedicationChangeRow => ({
    id: uuid(), household_id: ids.household, medication_id: medicationId, change_type: type,
    effective_at: effective, before, after, changed_by: ids.mom, created_at: created,
  }) as MedicationChangeRow;

  const medicationChanges: MedicationChangeRow[] = [
    ...medications.map((m) => change(m.id, "started", started, {}, { default_dose: m.default_dose, dose_unit: m.dose_unit, schedule: m.schedule })),
    change(ids.leoMelatonin, "dose_changed", ymd(melatoninChange), { default_dose: 0.5, dose_unit: "mg" }, { default_dose: 1, dose_unit: "mg" }),
  ];

  // ─── Entries ───────────────────────────────────────────────────────────────
  const entries: EntryRow[] = [];
  const push = (profileId: string, when: Date, type: string, data: Json, by: Caregiver = anyCaregiver(), extra: Partial<EntryRow> = {}) => {
    if (when.getTime() > anchor.getTime()) return;
    const t = iso(when);
    entries.push({
      id: uuid(), household_id: ids.household, profile_id: profileId, type, occurred_at: t, tz: opts.tz,
      ended_at: null, data, note: null, flagged_for_doctor: false,
      logged_by: by.id, logged_by_name: by.name, logged_by_initials: by.initials,
      created_at: t, updated_at: t, deleted_at: null, schema_version: 1, ...extra,
    } as EntryRow);
  };
  const dose = (medicationId: string, amount: number, unit: string, outcome: string, scheduledFor: Date | null, prnReason: string | null = null) => ({
    medication_id: medicationId, dose: amount, unit, outcome,
    scheduled_for: scheduledFor ? iso(scheduledFor) : null, prn_reason: prnReason,
    duplicate_override: false, followup: prnReason ? pick(["helped", "helped", "somewhat"]) : null,
  });

  const LEO_FOODS = {
    breakfast: [["oatmeal"], ["cereal", "banana"], ["toast", "yogurt"], ["pancakes"]],
    lunch: [["sandwich", "apple_slices"], ["mac_and_cheese"], ["chicken_nuggets", "carrots"], ["quesadilla"]],
    dinner: [["pasta", "carrots"], ["chicken", "rice"], ["tacos"], ["fish_sticks", "peas"]],
    snack: [["crackers"], ["apple_slices"], ["yogurt"], ["cheese_stick"]],
  };
  const groupsFor: Record<string, string[]> = {
    oatmeal: ["grains"], cereal: ["grains"], banana: ["fruit"], toast: ["grains"], yogurt: ["dairy"], pancakes: ["grains", "sweets_snacks"],
    sandwich: ["grains", "protein"], apple_slices: ["fruit"], mac_and_cheese: ["grains", "dairy"], chicken_nuggets: ["protein"],
    carrots: ["vegetables"], quesadilla: ["grains", "dairy"], pasta: ["grains"], chicken: ["protein"], rice: ["grains"],
    tacos: ["protein", "grains"], fish_sticks: ["protein"], peas: ["vegetables"], crackers: ["grains"], cheese_stick: ["dairy"],
  };
  const meal = (method: "meal" | "snack", mealType: string | undefined, foods: string[], portion: number, reactions: string[] = []) => ({
    method, ...(mealType ? { meal_type: mealType } : {}), portion_pct: portion,
    food_groups: [...new Set(foods.flatMap((f) => groupsFor[f] ?? []))], food_ids: foods, new_food: false, reactions,
  });

  for (let ago = days - 1; ago >= 1; ago--) {
    const day = dayStart(ago);
    const dow = day.getDay();
    const afterChange = day.getTime() >= melatoninChange.getTime();

    // ── Leo ──
    // AT-10 story: the last BM is 3 calendar days back (before 7 PM), so Leo is "3 days since BM" at story time.
    const hasBm = ago === 3 || (ago > 3 && !chance(0.18));
    if (hasBm) {
      push(ids.leo, at(day, between(7, 18), between(0, 59)), "bathroom", {
        kind: chance(0.25) ? "both" : "bm", location: "toilet", scale: "bristol",
        consistency: pick([2, 3, 4, 4, 4, 5]), size: pick(["small", "medium", "medium", "large"]),
        color: pick(["brown", "brown", "brown", "green"]), flags: chance(0.06) ? ["straining_pain"] : [],
      });
    }
    for (let i = 0, n = between(3, 5); i < n; i++) {
      push(ids.leo, at(day, between(6, 20), between(0, 59)), "bathroom", {
        kind: "pee", location: chance(0.05) ? "accident" : "toilet", flags: [],
      });
    }

    push(ids.leo, at(day, 7, between(20, 50)), "eating", meal("meal", "breakfast", pick(LEO_FOODS.breakfast), pick([50, 75, 100, 100])));
    push(ids.leo, at(day, 12, between(0, 30)), "eating", meal("meal", "lunch", pick(LEO_FOODS.lunch), pick([50, 75, 75, 100])));
    if (chance(0.6)) push(ids.leo, at(day, 15, between(0, 40)), "eating", meal("snack", undefined, pick(LEO_FOODS.snack), pick([50, 100])));
    push(ids.leo, at(day, 18, between(30, 59)), "eating", meal("meal", "dinner", pick(LEO_FOODS.dinner), pick([25, 50, 50, 75, 100]), chance(0.07) ? ["refused"] : []));
    if (chance(0.5)) push(ids.leo, at(day, 16, 10), "eating", { method: "drink", contents: pick(["water", "milk"]), amount_ml: pick([180, 240]) });

    if (dow >= 1 && dow <= 5) {
      push(ids.leo, at(day, 8, 30), "activity", { activity_id: "school", enjoyment: pick([3, 3, 4, 4, 5]), duration_min: 360 }, cg.mom);
      push(ids.leo, at(day, 16, between(0, 30)), "activity", {
        activity_id: pick(["playground", "reading", "screen_time", "building_toys", "therapy", "music"]),
        enjoyment: chance(0.1) ? null : pick([3, 4, 4, 5, 5]), duration_min: pick([15, 30, 30, 60]),
      });
    } else {
      for (let i = 0, n = between(1, 2); i < n; i++) {
        push(ids.leo, at(day, between(9, 16), between(0, 59)), "activity", {
          activity_id: pick(["swimming", "playground", "sensory_play", "art", "sports", "playdate"]),
          enjoyment: pick([3, 4, 5, 5]), duration_min: pick([30, 60, 90]),
        });
      }
    }

    // Story: mood lifts after the Melatonin change (S13/S14: about 2.8 before, 3.4 after),
    // 4 to 7 PM is the hardest block (PAT-01), and days without a BM run lower (PAT-02).
    const bmPenalty = hasBm ? 0 : 0.8;
    const lift = afterChange ? 0.6 : 0;
    push(ids.leo, at(day, between(8, 10), between(0, 59)), "mood", {
      scope: "moment", level: clamp(3.5 + lift - bmPenalty + (rand() - 0.5)), feelings: pick([["happy"], ["calm"], ["excited"], ["tired"], []]), behaviors: [],
    });
    if (chance(0.7)) {
      push(ids.leo, at(day, between(12, 14), between(0, 59)), "mood", {
        scope: "moment", level: clamp(3.2 + lift - bmPenalty + (rand() - 0.5)), feelings: pick([["calm"], ["happy"], ["tired"], []]), behaviors: [],
      });
    }
    const evening = 2.3 + lift - bmPenalty + (rand() - 0.5) * 1.2;
    const behavior = evening < 2.4 && chance(0.7)
      ? [{ key: pick(["meltdown", "meltdown", "tantrum", "transitions"]), severity: pick(["mild", "moderate", "moderate", "severe"]) }]
      : [];
    push(ids.leo, at(day, between(16, 18), between(0, 59)), "mood", {
      scope: "moment", level: clamp(evening), feelings: pick([["frustrated"], ["tired"], ["overwhelmed"], ["calm"], []]), behaviors: behavior,
    }, anyCaregiver(), behavior[0]?.severity === "severe" ? { flagged_for_doctor: true } : {});

    const leoDose = (id: string, h: number, m: number, amount: number, unit: string) => {
      if (chance(0.04)) return; // not logged
      const outcome = chance(0.06) ? "refused" : "given";
      push(ids.leo, at(day, h, m + between(-10, 25)), "medication", dose(id, amount, unit, outcome, at(day, h, m)));
    };
    leoDose(ids.leoAllergy, 8, 0, 5, "mL");
    leoDose(ids.leoFiber, 12, 0, 1, "gummy");
    leoDose(ids.leoMelatonin, 19, 30, afterChange ? 1 : 0.5, "mg");
    if (chance(0.12)) {
      push(ids.leo, at(day, between(9, 20), between(0, 59)), "medication", dose(ids.leoIbuprofen, 7.5, "mL", "given", null, pick(["fever", "pain", "pain"])));
    }

    // ── Maya ──
    for (let i = 0, n = between(6, 8); i < n; i++) {
      push(ids.maya, at(day, Math.min(23, Math.floor((i * 24) / n) + between(0, 2)), between(0, 59)), "bathroom", {
        kind: chance(0.2) ? "both" : "pee", location: "diaper", flags: chance(0.04) ? ["diaper_rash"] : [],
      });
    }
    for (let i = 0, n = between(1, 2); i < n; i++) {
      push(ids.maya, at(day, between(7, 19), between(0, 59)), "bathroom", {
        kind: "bm", location: "diaper", scale: "aiss", consistency: pick(["soft", "soft", "watery", "formed"]),
        color: pick(["yellow", "yellow", "brown", "green"]), size: pick(["small", "medium"]), flags: chance(0.05) ? ["blowout_leak"] : [],
      });
    }
    let lastSide = "left";
    for (let i = 0, n = between(6, 8); i < n; i++) {
      const when = at(day, Math.min(23, Math.floor((i * 24) / n) + between(0, 1)), between(0, 59));
      if (chance(0.6)) {
        const side = lastSide === "left" ? "right" : "left";
        lastSide = side;
        push(ids.maya, when, "eating", { method: "breast", side, duration_min: pick([10, 15, 15, 20]) });
      } else {
        push(ids.maya, when, "eating", { method: "bottle", contents: pick(["formula", "formula", "breast_milk"]), amount_ml: pick([89, 118, 118, 148]) });
      }
    }
    if (ago < 30) push(ids.maya, at(day, 12, between(0, 30)), "eating", meal("meal", "lunch", pick([["puree"], ["banana"], ["oatmeal"]]), pick([25, 50, 75])));
    push(ids.maya, at(day, between(8, 13), between(0, 59)), "mood", { scope: "moment", level: pick([3, 4, 4, 5]), feelings: pick([["calm"], ["alert"], []]), behaviors: [] });
    if (chance(0.5)) push(ids.maya, at(day, between(16, 19), between(0, 59)), "mood", { scope: "moment", level: pick([2, 3, 4]), feelings: pick([["fussy"], ["sleepy"], ["teething"], []]), behaviors: [] });
    push(ids.maya, at(day, between(9, 11), between(0, 59)), "activity", { activity_id: pick(["tummy_time", "tummy_time", "play_mat", "reading", "walk"]), enjoyment: pick([3, 4, 5]), duration_min: pick([5, 15, 15, 30]) });
    if (!chance(0.03)) push(ids.maya, at(day, 9, between(0, 20)), "medication", dose(ids.mayaVitaminD, 1, "drop", chance(0.04) ? "spit_up_vomited" : "given", at(day, 9, 0)));
  }

  // ─── Today: the exact mockup story (S01, S06, S10, S12, S18) ──────────────
  const today = dayStart(0);
  push(ids.leo, at(today, 7, 40), "eating", meal("meal", "breakfast", ["oatmeal"], 100), cg.dad);
  push(ids.leo, at(today, 8, 2), "medication", dose(ids.leoAllergy, 5, "mL", "given", at(today, 8, 0)), cg.dad);
  push(ids.leo, at(today, 7, 15), "bathroom", { kind: "pee", location: "toilet", flags: [] }, cg.dad);
  push(ids.leo, at(today, 12, 0), "eating", meal("meal", "lunch", ["sandwich", "apple_slices"], 75), cg.grandma);
  push(ids.leo, at(today, 12, 15), "medication", dose(ids.leoFiber, 1, "gummy", "given", at(today, 12, 0)), cg.grandma);
  push(ids.leo, at(today, 16, 15), "activity", { activity_id: "playground", enjoyment: 5, duration_min: 30 }, cg.grandma);
  push(ids.leo, at(today, 10, 5), "mood", { scope: "moment", level: 4, feelings: ["calm"], behaviors: [] }, cg.mom);
  push(ids.leo, at(today, 17, 30), "mood", {
    scope: "moment", level: 2, feelings: ["frustrated"], behaviors: [{ key: "meltdown", severity: "moderate", duration_min: 15 }],
  }, cg.mom, { flagged_for_doctor: true, note: "Melted down when screen time ended." });
  push(ids.leo, at(today, 18, 0), "medication", { ...dose(ids.leoIbuprofen, 7.5, "mL", "given", null, "fever"), followup: null }, cg.dad);
  push(ids.leo, at(today, 18, 45), "eating", meal("meal", "dinner", ["pasta", "carrots"], 50), cg.mom);

  push(ids.maya, at(today, 9, 0), "medication", dose(ids.mayaVitaminD, 1, "drop", "given", at(today, 9, 0)), cg.mom);
  push(ids.maya, at(today, 10, 30), "activity", { activity_id: "tummy_time", enjoyment: 4, duration_min: 15 }, cg.mom);
  for (const [h, m] of [[1, 10], [4, 20], [7, 5], [10, 40], [13, 50], [16, 15]] as const) {
    push(ids.maya, at(today, h, m), "bathroom", { kind: "pee", location: "diaper", flags: [] });
  }
  push(ids.maya, at(today, 11, 20), "bathroom", { kind: "bm", location: "diaper", scale: "aiss", consistency: "soft", color: "yellow", size: "medium", flags: [] }, cg.mom);
  for (const [h, m, side] of [[2, 0, "left"], [6, 30, "right"], [10, 0, "left"], [13, 30, "right"]] as const) {
    push(ids.maya, at(today, h, m), "eating", { method: "breast", side, duration_min: 15 }, cg.mom);
  }
  push(ids.maya, at(today, 17, 0), "eating", { method: "bottle", contents: "formula", amount_ml: 118 }, cg.dad);
  push(ids.maya, at(today, 18, 30), "mood", { scope: "moment", level: 4, feelings: ["calm"], behaviors: [] }, cg.dad);

  entries.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  // ─── Appointments ──────────────────────────────────────────────────────────
  const apptDay = (offset: number) => {
    const d = new Date(startOfAnchorDay);
    d.setDate(d.getDate() + offset);
    return ymd(d);
  };
  const appointments: AppointmentRow[] = [
    { id: uuid(), household_id: ids.household, profile_id: ids.leo,  date: apptDay(-40), provider: "Dr. Chen (Pediatrician)", notes: "Asthma check", created_at: created },
    { id: uuid(), household_id: ids.household, profile_id: ids.leo,  date: apptDay(15),  provider: "Dr. Chen (Pediatrician)", notes: "6-year well visit", created_at: created },
    { id: uuid(), household_id: ids.household, profile_id: ids.maya, date: apptDay(-30), provider: "Dr. Patel (Pediatrician)", notes: "6-month well visit", created_at: created },
    { id: uuid(), household_id: ids.household, profile_id: ids.maya, date: apptDay(8),   provider: "Dr. Patel (Pediatrician)", notes: "Weight check", created_at: created },
  ] as AppointmentRow[];

  // Quick taps from the mockups (S01, S18): Pee, Water, Allergy med for Leo; Wet diaper, Dirty diaper, Bottle 4 oz for Maya.
  const favorite = (profileId: string, label: string, type: string, data: Json, order: number): FavoriteRow => ({
    id: uuid(), household_id: ids.household, profile_id: profileId, label, entry_template: { type, data }, sort_order: order, created_at: created,
  });
  const favorites: FavoriteRow[] = [
    favorite(ids.leo, "Pee", "bathroom", { kind: "pee", location: "toilet", flags: [] }, 0),
    favorite(ids.leo, "Water", "eating", { method: "drink", contents: "water" }, 1),
    favorite(ids.leo, "Allergy med", "medication", { medication_id: ids.leoAllergy, dose: 5, unit: "mL", outcome: "given", scheduled_for: null, prn_reason: null, duplicate_override: false, followup: null }, 2),
    favorite(ids.maya, "Wet diaper", "bathroom", { kind: "pee", location: "diaper", flags: [] }, 0),
    favorite(ids.maya, "Dirty diaper", "bathroom", { kind: "bm", location: "diaper", flags: [] }, 1),
    favorite(ids.maya, "Bottle 4 oz", "eating", { method: "bottle", contents: "formula", amount_ml: 120 }, 2),
  ];

  // EAT-08: each child's foods list holds what the story's meals used. EAT-09: Maya's first taste of each is an introduction.
  const foodLabel = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
  const eatingOf = (profileId: string) => entries.filter((e) => e.profile_id === profileId && e.type === "eating");
  const options: OptionRow[] = [ids.leo, ids.maya].flatMap((profileId) =>
    [...new Set(eatingOf(profileId).flatMap((e) => (e.data as { food_ids?: string[] }).food_ids ?? []))].sort().map((key, i) => ({
      id: uuid(), household_id: ids.household, profile_id: profileId, module: "food", key, label: foodLabel(key),
      icon: null, sort_order: i, archived: false, created_at: created,
    }) as OptionRow),
  );
  const tasted = new Set<string>();
  for (const e of eatingOf(ids.maya).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    const d = e.data as { food_ids?: string[]; new_food?: boolean };
    const foods = d.food_ids ?? [];
    if (foods.some((f) => !tasted.has(f))) d.new_food = true;
    foods.forEach((f) => tasted.add(f));
  }

  return { household, members, profiles, medications, medicationChanges, entries, appointments, options, favorites };
}

/** The mockup story's moment: Mon, Oct 26, 2026 at 7:05 PM, 25 minutes before Melatonin is due. */
export function storyAnchor(): Date {
  return new Date(2026, 9, 26, 19, 5, 0, 0);
}
