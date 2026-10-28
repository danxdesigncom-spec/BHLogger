// AT-09 / ACC-09: role enforcement in the database (RLS), not just the UI.
// Runs against the real project with the seeded Rodriguez Family: `pnpm test:rls`.
// Skipped unless RLS_TEST=1, so `pnpm test` stays offline.
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const enabled = process.env.RLS_TEST === "1" && !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "SeedPassword123!";
const HOUSEHOLD = "a1000000-0000-0000-0000-000000000001";
const LEO = "a1000000-0000-0000-0000-000000000008";

async function signIn(email: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user) throw new Error(`Sign-in failed for ${email}: ${error?.message}`);
  return { client, userId: data.user.id };
}

describe.skipIf(!enabled)("RLS role enforcement (AT-09)", () => {
  let dad: { client: SupabaseClient; userId: string };
  let mom: { client: SupabaseClient; userId: string };
  let momsEntry: { id: string; note: string | null };
  let dadsEntry: { id: string; note: string | null };

  beforeAll(async () => {
    dad = await signIn("dad@rodriguez.example");
    mom = await signIn("mom@rodriguez.example");
    const pick = async (userId: string) => {
      const { data } = await dad.client.from("entries").select("id, note").eq("logged_by", userId).is("deleted_at", null).limit(1).single();
      return data!;
    };
    momsEntry = await pick(mom.userId);
    dadsEntry = await pick(dad.userId);
  });

  it("a caregiver can't edit another caregiver's entry", async () => {
    const { data, error } = await dad.client.from("entries").update({ note: "changed by Dad" }).eq("id", momsEntry.id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a caregiver can't soft-delete another caregiver's entry", async () => {
    const { data } = await dad.client.from("entries").update({ deleted_at: new Date().toISOString() }).eq("id", momsEntry.id).select("id");
    expect(data).toEqual([]);
  });

  it("a caregiver can edit their own entry (positive control)", async () => {
    const { data } = await dad.client.from("entries").update({ note: dadsEntry.note }).eq("id", dadsEntry.id).select("id");
    expect(data).toHaveLength(1);
  });

  it("an admin can edit anyone's entry (positive control)", async () => {
    const { data } = await mom.client.from("entries").update({ note: momsEntry.note }).eq("id", momsEntry.id).select("id");
    expect(data).toHaveLength(1);
  });

  it("a caregiver can't change household settings", async () => {
    const { data } = await dad.client.from("households").update({ name: "Renamed by Dad" }).eq("id", HOUSEHOLD).select("id");
    expect(data).toEqual([]);
  });

  it("a caregiver can't write into another household", async () => {
    const { error } = await dad.client.from("entries").insert({
      id: crypto.randomUUID(), household_id: crypto.randomUUID(), profile_id: LEO, type: "mood", occurred_at: new Date().toISOString(),
      tz: "UTC", data: { scope: "moment", level: 3, feelings: [], behaviors: [] }, logged_by: dad.userId, logged_by_name: "Dad", logged_by_initials: "DR",
    });
    expect(error).not.toBeNull();
  });

  it("a caregiver can't read the audit log", async () => {
    const { data } = await dad.client.from("audit_events").select("id").limit(1);
    expect(data ?? []).toEqual([]);
  });
});
