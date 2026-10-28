/**
 * Seed script: recreates the Rodriguez Family story used in the mockups.
 * Leo (6, violet, toilet) and Maya (7 months, teal, diapers); Mom, Dad and Grandma.
 * 60 days ending Mon, Oct 26, 2026 at 7:05 PM. The data comes from lib/demo/generate.ts,
 * the same generator demo mode uses.
 *
 * Re-runnable: it clears the seed household's entries and appointments, then upserts everything.
 *
 * Usage: pnpm db:seed   (reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local)
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/types";
import { generateHouseholdData, SEED_IDS, storyAnchor } from "../lib/demo/generate";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getOrCreateAuthUser(preferredId: string, email: string, name: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    id: preferredId,
    email,
    email_confirm: true,
    user_metadata: { full_name: name },
    password: "SeedPassword123!",
  });
  if (!error) return data.user.id;

  const msg = error.message.toLowerCase();
  if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("duplicate")) {
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((u) => u.email === email);
    if (existing) return existing.id;
  }
  throw new Error(`createUser ${email}: ${error.message}`);
}

function check(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function seed() {
  console.log("Seeding the Rodriguez Family story…\n");

  const mom = await getOrCreateAuthUser(SEED_IDS.mom, "mom@rodriguez.example", "Mom Rodriguez");
  const dad = await getOrCreateAuthUser(SEED_IDS.dad, "dad@rodriguez.example", "Dad Rodriguez");
  const grandma = await getOrCreateAuthUser(SEED_IDS.grandma, "grandma@rodriguez.example", "Grandma Rodriguez");

  const data = generateHouseholdData({
    anchor: storyAnchor(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ids: { mom, dad, grandma },
  });

  console.log("  Household, members and profiles…");
  check("household", (await supabase.from("households").upsert(data.household)).error);
  check("members", (await supabase.from("household_members").upsert(data.members)).error);
  check("profiles", (await supabase.from("profiles").upsert(data.profiles)).error);

  console.log("  Medications and change history…");
  check("medications", (await supabase.from("medications").upsert(data.medications)).error);
  check("medication_changes", (await supabase.from("medication_changes").upsert(data.medicationChanges)).error);

  console.log("  Clearing old entries and appointments…");
  check("clear entries", (await supabase.from("entries").delete().eq("household_id", SEED_IDS.household)).error);
  check("clear appointments", (await supabase.from("appointments").delete().eq("household_id", SEED_IDS.household)).error);

  console.log(`  Inserting ${data.entries.length} entries…`);
  for (let i = 0; i < data.entries.length; i += 500) {
    check(`entries batch ${i}`, (await supabase.from("entries").insert(data.entries.slice(i, i + 500))).error);
  }
  check("appointments", (await supabase.from("appointments").insert(data.appointments)).error);

  console.log("\nSeed complete.");
  console.log(`  Household: ${SEED_IDS.household}`);
  console.log(`  Entries:   ${data.entries.length}`);
  console.log("  Sign in as mom@rodriguez.example (magic link) to see it.");
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
