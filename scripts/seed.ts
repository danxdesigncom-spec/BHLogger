/**
 * Seed script — recreates the Rodriguez Family demo data used in mockups.
 *
 * Profiles: Leo (age 6, violet, child, toilet) + Maya (7 months, teal, baby, diapers)
 * Caregivers: Mom, Dad, Grandma
 * Anchor date: Monday Oct 26, 2026 (mockup story date)
 * Range: 60 days ending Oct 26
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npx tsx scripts/seed.ts
 *   or:
 *   pnpm seed
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import type { Database, Json } from "../lib/supabase/types";

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.",
  );
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Deterministic PRNG (mulberry32) ─────────────────────────────────────────
// Seeded so the same data is produced on every run.

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261026);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randBool(prob = 0.5): boolean {
  return rand() < prob;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ANCHOR = new Date("2026-10-26T00:00:00-05:00"); // Chicago time (CDT ends 11/1)
const TZ = "America/Chicago";

function daysAgo(n: number): Date {
  const d = new Date(ANCHOR);
  d.setDate(d.getDate() - n);
  return d;
}

function isoAt(date: Date, hour: number, minute = 0): string {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// ─── IDs ──────────────────────────────────────────────────────────────────────

const IDS = {
  household: randomUUID(),
  // auth users
  mom: randomUUID(),
  dad: randomUUID(),
  grandma: randomUUID(),
  // household members
  momMember: randomUUID(),
  dadMember: randomUUID(),
  grandmaMember: randomUUID(),
  // profiles
  leo: randomUUID(),
  maya: randomUUID(),
  // medications
  leoVitamin: randomUUID(),
  mayaVitamin: randomUUID(),
  leoAlbuterol: randomUUID(),
};

// ─── Auth users ───────────────────────────────────────────────────────────────

async function createAuthUser(
  id: string,
  email: string,
  name: string,
): Promise<void> {
  const { error } = await supabase.auth.admin.createUser({
    id,
    email,
    email_confirm: true,
    user_metadata: { full_name: name },
    password: "SeedPassword123!",
  });
  if (error && !error.message.includes("already registered")) {
    throw new Error(`createUser ${email}: ${error.message}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding Rodriguez Family demo data…\n");

  // 1. Auth users
  console.log("  Creating auth users…");
  await createAuthUser(IDS.mom, "mom@rodriguez.example", "Mom Rodriguez");
  await createAuthUser(IDS.dad, "dad@rodriguez.example", "Dad Rodriguez");
  await createAuthUser(
    IDS.grandma,
    "grandma@rodriguez.example",
    "Grandma Rodriguez",
  );

  // 2. Household
  console.log("  Creating household…");
  const { error: hhErr } = await supabase.from("households").upsert({
    id: IDS.household,
    name: "Rodriguez Family",
    settings: {
      volume_unit: "oz",
      time_format: "12h",
      week_start: "sunday",
      locale: "en",
    },
  });
  if (hhErr) throw new Error(`household: ${hhErr.message}`);

  // 3. Household members
  console.log("  Creating household members…");
  const members = [
    {
      id: IDS.momMember,
      household_id: IDS.household,
      user_id: IDS.mom,
      role: "admin" as const,
      display_name: "Mom",
      initials: "MR",
    },
    {
      id: IDS.dadMember,
      household_id: IDS.household,
      user_id: IDS.dad,
      role: "caregiver" as const,
      display_name: "Dad",
      initials: "DR",
    },
    {
      id: IDS.grandmaMember,
      household_id: IDS.household,
      user_id: IDS.grandma,
      role: "caregiver" as const,
      display_name: "Grandma",
      initials: "GR",
    },
  ];
  const { error: memErr } = await supabase
    .from("household_members")
    .upsert(members);
  if (memErr) throw new Error(`members: ${memErr.message}`);

  // 4. Profiles
  console.log("  Creating profiles…");
  const profiles = [
    {
      id: IDS.leo,
      household_id: IDS.household,
      name: "Leo",
      color: "violet" as const,
      dob: "2020-10-26", // exactly 6 on anchor date
      care_stage: "child" as const,
      toileting: "toilet" as const,
      feeding_methods: ["self"],
      enabled_modules: ["bathroom", "eating", "activity", "mood", "medication"],
      settings: { bm_alert_days: 3, med_duplicate_window_min: 60 } as Json,
      care_card: {
        allergies: ["peanuts"],
        conditions: ["mild asthma"],
        doctor: { name: "Dr. Chen", phone: "312-555-0100" },
        emergency_contacts: [{ name: "Mom", phone: "312-555-0101" }],
      } as Json,
    },
    {
      id: IDS.maya,
      household_id: IDS.household,
      name: "Maya",
      color: "teal" as const,
      dob: "2026-03-26", // ~7 months on anchor date
      care_stage: "baby" as const,
      toileting: "diapers" as const,
      feeding_methods: ["breast", "bottle"],
      enabled_modules: ["bathroom", "eating", "mood", "medication"],
      settings: { wet_diaper_min: 6, bm_alert_days: 2 } as Json,
      care_card: {
        allergies: [],
        conditions: [],
        doctor: { name: "Dr. Patel", phone: "312-555-0200" },
        emergency_contacts: [{ name: "Mom", phone: "312-555-0101" }],
      } as Json,
    },
  ];
  const { error: profErr } = await supabase.from("profiles").upsert(profiles);
  if (profErr) throw new Error(`profiles: ${profErr.message}`);

  // 5. Medications
  console.log("  Creating medications…");
  const meds = [
    {
      id: IDS.leoVitamin,
      household_id: IDS.household,
      profile_id: IDS.leo,
      name: "Vitamin D",
      form: "gummy",
      strength: "600 IU",
      default_dose: 1,
      dose_unit: "gummy",
      kind: "scheduled" as const,
      schedule: { times: ["08:00"] },
      dose_window_min: 60,
      active: true,
    },
    {
      id: IDS.leoAlbuterol,
      household_id: IDS.household,
      profile_id: IDS.leo,
      name: "Albuterol",
      form: "inhaler",
      strength: "90 mcg",
      default_dose: 2,
      dose_unit: "puffs",
      kind: "prn" as const,
      min_interval_hours: 4,
      purpose: "asthma rescue",
      prescriber: "Dr. Chen",
      instructions: "2 puffs as needed for wheezing or shortness of breath",
      active: true,
    },
    {
      id: IDS.mayaVitamin,
      household_id: IDS.household,
      profile_id: IDS.maya,
      name: "Vitamin D",
      form: "drops",
      strength: "400 IU/drop",
      default_dose: 1,
      dose_unit: "drop",
      kind: "scheduled" as const,
      schedule: { times: ["09:00"] },
      dose_window_min: 60,
      active: true,
    },
  ];
  const { error: medErr } = await supabase.from("medications").upsert(meds);
  if (medErr) throw new Error(`medications: ${medErr.message}`);

  // 6. Entries (60 days)
  console.log("  Generating 60 days of entries…");
  const entries: Database["public"]["Tables"]["entries"]["Insert"][] = [];

  const caregivers = [
    {
      id: IDS.mom,
      name: "Mom",
      initials: "MR",
      memberId: IDS.momMember,
    },
    {
      id: IDS.dad,
      name: "Dad",
      initials: "DR",
      memberId: IDS.dadMember,
    },
    {
      id: IDS.grandma,
      name: "Grandma",
      initials: "GR",
      memberId: IDS.grandmaMember,
    },
  ];

  function caregiver() {
    // Mom logs ~60%, Dad ~30%, Grandma ~10%
    const r = rand();
    if (r < 0.6) return caregivers[0];
    if (r < 0.9) return caregivers[1];
    return caregivers[2];
  }

  function entry(
    profileId: string,
    date: Date,
    hour: number,
    type: string,
    data: Json,
    note?: string,
  ): Database["public"]["Tables"]["entries"]["Insert"] {
    const cg = caregiver();
    return {
      id: randomUUID(),
      household_id: IDS.household,
      profile_id: profileId,
      type,
      occurred_at: isoAt(date, hour, randInt(0, 55)),
      tz: TZ,
      ended_at: null,
      data,
      note: note ?? null,
      flagged_for_doctor: false,
      logged_by: cg.id,
      logged_by_name: cg.name,
      logged_by_initials: cg.initials,
    };
  }

  // ── Leo entries ────────────────────────────────────────────────────────────
  for (let day = 59; day >= 0; day--) {
    const d = daysAgo(day);

    // Bathroom: ~1 BM per day, ~3 pees
    const bmHour = randInt(7, 20);
    entries.push(
      entry(IDS.leo, d, bmHour, "bathroom", {
        kind: pick(["bm", "both"]),
        location: "toilet",
        consistency: pick(["soft", "formed"]),
        size: pick(["small", "medium"]),
        color: pick(["brown", "brown", "brown", "green"]),
        flags: [],
      }),
    );
    for (let p = 0; p < randInt(2, 4); p++) {
      entries.push(
        entry(IDS.leo, d, randInt(6, 21), "bathroom", {
          kind: "pee",
          location: "toilet",
          flags: [],
        }),
      );
    }

    // Eating: breakfast, lunch, dinner, optional snack
    entries.push(
      entry(IDS.leo, d, 7, "eating", {
        method: "meal",
        meal_type: "breakfast",
        portion_pct: pick([25, 50, 75, 100]),
        food_groups: pick([["grain", "dairy"], ["fruit", "grain"], ["grain"]]),
        food_ids: [],
        new_food: false,
        reactions: [],
      }),
    );
    entries.push(
      entry(IDS.leo, d, 12, "eating", {
        method: "meal",
        meal_type: "lunch",
        portion_pct: pick([50, 75, 100]),
        food_groups: pick([["protein", "grain", "vegetable"], ["protein", "grain"], ["grain", "vegetable"]]),
        food_ids: [],
        new_food: false,
        reactions: [],
      }),
    );
    entries.push(
      entry(IDS.leo, d, 18, "eating", {
        method: "meal",
        meal_type: "dinner",
        portion_pct: pick([50, 75, 75, 100]),
        food_groups: ["protein", "grain", "vegetable"],
        food_ids: [],
        new_food: false,
        reactions: [],
      }),
    );
    if (randBool(0.6)) {
      entries.push(
        entry(IDS.leo, d, pick([10, 15]), "eating", {
          method: "snack",
          meal_type: "snack",
          portion_pct: pick([50, 100]),
          food_groups: pick([["fruit"], ["grain"], ["dairy"]]),
          food_ids: [],
          new_food: false,
          reactions: [],
        }),
      );
    }

    // Activity: school days M-F
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      entries.push(
        entry(IDS.leo, d, 15, "activity", {
          activity_id: pick(["school", "outdoor_play", "reading"]),
          enjoyment: pick([3, 4, 4, 5]),
          duration_min: pick([60, 90, 120]),
        }),
      );
    } else {
      entries.push(
        entry(IDS.leo, d, randInt(9, 15), "activity", {
          activity_id: pick(["outdoor_play", "art", "sports", "swimming"]),
          enjoyment: pick([3, 4, 5]),
          duration_min: pick([30, 45, 60, 90]),
        }),
      );
    }

    // Mood: 1-2x per day
    entries.push(
      entry(IDS.leo, d, randInt(8, 14), "mood", {
        scope: "moment",
        level: pick([3, 4, 4, 5, 5]),
        feelings: pick([["happy"], ["calm"], ["excited"], ["tired"], []]),
        behaviors: [],
      }),
    );
    if (randBool(0.4)) {
      entries.push(
        entry(IDS.leo, d, randInt(15, 20), "mood", {
          scope: "moment",
          level: pick([2, 3, 4, 4]),
          feelings: pick([["tired"], ["frustrated"], ["happy"], []]),
          behaviors: randBool(0.2)
            ? [{ key: "tantrum", severity: "mild" }]
            : [],
        }),
      );
    }

    // Medication: daily vitamin
    entries.push(
      entry(IDS.leo, d, 8, "medication", {
        medication_id: IDS.leoVitamin,
        dose: 1,
        unit: "gummy",
        outcome: randBool(0.9) ? "given" : "refused",
        scheduled_for: isoAt(d, 8),
        prn_reason: null,
        duplicate_override: false,
        followup: null,
      }),
    );

    // Albuterol: ~1 in 10 days
    if (randBool(0.1)) {
      entries.push(
        entry(IDS.leo, d, randInt(8, 20), "medication", {
          medication_id: IDS.leoAlbuterol,
          dose: 2,
          unit: "puffs",
          outcome: "given",
          scheduled_for: null,
          prn_reason: "wheezing",
          duplicate_override: false,
          followup: null,
        }),
      );
    }
  }

  // ── Maya entries ───────────────────────────────────────────────────────────
  for (let day = 59; day >= 0; day--) {
    const d = daysAgo(day);

    // Bathroom: 5-8 wet diapers, 1-2 BMs
    const wets = randInt(5, 8);
    const wetHours = Array.from({ length: wets }, () => randInt(0, 23)).sort(
      (a, b) => a - b,
    );
    for (const h of wetHours) {
      entries.push(
        entry(IDS.maya, d, h, "bathroom", {
          kind: randBool(0.3) ? "both" : "pee",
          location: "diaper",
          flags: randBool(0.05) ? ["diaper_rash"] : [],
        }),
      );
    }
    const bms = randInt(1, 2);
    for (let b = 0; b < bms; b++) {
      entries.push(
        entry(IDS.maya, d, randInt(6, 20), "bathroom", {
          kind: "bm",
          location: "diaper",
          consistency: pick(["soft", "watery"]),
          color: pick(["yellow", "brown", "green"]),
          size: pick(["small", "medium"]),
          flags: [],
        }),
      );
    }

    // Eating: 7-9 feeds — mix of breast and bottle
    const feeds = randInt(7, 9);
    // Space feeds roughly evenly across the day
    const feedHours = Array.from({ length: feeds }, (_, i) =>
      Math.round((i * 24) / feeds + rand() * 1.5),
    );
    for (const h of feedHours) {
      const method = randBool(0.65) ? "breast" : "bottle";
      if (method === "breast") {
        entries.push(
          entry(IDS.maya, d, h, "eating", {
            method: "breast",
            side: pick(["left", "right", "both"]),
            duration_min: randInt(8, 20),
          }),
        );
      } else {
        entries.push(
          entry(IDS.maya, d, h, "eating", {
            method: "bottle",
            contents: pick(["breast_milk", "formula"]),
            amount_ml: randInt(60, 150),
          }),
        );
      }
    }

    // Mood: 1-2x
    entries.push(
      entry(IDS.maya, d, randInt(8, 14), "mood", {
        scope: "moment",
        level: pick([3, 4, 4, 5]),
        feelings: pick([["happy"], ["calm"], []]),
        behaviors: [],
      }),
    );

    // Medication: daily vitamin D drops
    entries.push(
      entry(IDS.maya, d, 9, "medication", {
        medication_id: IDS.mayaVitamin,
        dose: 1,
        unit: "drop",
        outcome: randBool(0.95) ? "given" : "spit_up_vomited",
        scheduled_for: isoAt(d, 9),
        prn_reason: null,
        duplicate_override: false,
        followup: null,
      }),
    );
  }

  // Insert entries in batches of 500
  console.log(`  Inserting ${entries.length} entries…`);
  const BATCH = 500;
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    const { error: entErr } = await supabase.from("entries").upsert(slice);
    if (entErr) throw new Error(`entries batch ${i}: ${entErr.message}`);
    process.stdout.write(`    ${Math.min(i + BATCH, entries.length)} / ${entries.length}\r`);
  }
  process.stdout.write("\n");

  // 7. Appointments
  console.log("  Creating appointments…");
  const appts = [
    {
      id: randomUUID(),
      household_id: IDS.household,
      profile_id: IDS.leo,
      date: "2026-11-10",
      provider: "Dr. Chen (Pediatrician)",
      notes: "6-year well visit + flu shot",
    },
    {
      id: randomUUID(),
      household_id: IDS.household,
      profile_id: IDS.maya,
      date: "2026-11-03",
      provider: "Dr. Patel (Pediatrician)",
      notes: "7-month well visit",
    },
  ];
  const { error: apptErr } = await supabase.from("appointments").upsert(appts);
  if (apptErr) throw new Error(`appointments: ${apptErr.message}`);

  console.log("\n✅ Seed complete!");
  console.log(`   Household: ${IDS.household}`);
  console.log(`   Leo:       ${IDS.leo}`);
  console.log(`   Maya:      ${IDS.maya}`);
  console.log(`   Entries:   ${entries.length}`);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
