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
    // Each person gets their own storage key, so two signed-in clients in one process don't share one.
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `rls-${email}` },
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

  // SET-07 (needs migrations 20261029000004 to 20261030000006). These leave the seed story as it was.
  it("a caregiver can't delete a profile", async () => {
    const { error } = await dad.client.rpc("delete_profile", { p_profile_id: LEO });
    expect(error?.message).toContain("admin_only");
    const { data } = await mom.client.from("profiles").select("id").eq("id", LEO);
    expect(data).toHaveLength(1);
  });

  it("an admin can delete a profile, and everything logged for it goes with it (positive control)", async () => {
    const id = crypto.randomUUID();
    const { error: createError } = await mom.client.from("profiles").insert({ id, household_id: HOUSEHOLD, name: "RLS test", color: "blue", care_stage: "child" });
    expect(createError).toBeNull();
    const entry = crypto.randomUUID();
    await mom.client.from("entries").insert({
      id: entry, household_id: HOUSEHOLD, profile_id: id, type: "mood", occurred_at: new Date().toISOString(), tz: "UTC",
      data: { scope: "moment", level: 3, feelings: [], behaviors: [] }, logged_by: mom.userId, logged_by_name: "Mom", logged_by_initials: "MR",
    });

    const { error } = await mom.client.rpc("delete_profile", { p_profile_id: id });
    expect(error).toBeNull();
    expect((await mom.client.from("profiles").select("id").eq("id", id)).data).toEqual([]);
    expect((await mom.client.from("entries").select("id").eq("id", entry)).data).toEqual([]);
    const { data: audit } = await mom.client.from("audit_events").select("action").eq("target", id);
    expect(audit).toEqual([{ action: "profile.deleted" }]);
  });

  it("the only admin can't delete their account while other members remain, in any of their households", async () => {
    // Mom may belong to other households too; the refusal must come before anything in any of them changes.
    const before = (await mom.client.from("household_members").select("household_id").eq("user_id", mom.userId)).data ?? [];
    const { error } = await mom.client.rpc("delete_my_account");
    expect(error?.message).toContain("last_admin");
    // If this ever fails, Mom has left the seed household: run `pnpm db:seed` to restore it.
    const after = (await mom.client.from("household_members").select("household_id").eq("user_id", mom.userId)).data ?? [];
    expect(after.map((m) => m.household_id).sort()).toEqual(before.map((m) => m.household_id).sort());
    expect(after.some((m) => m.household_id === HOUSEHOLD)).toBe(true);
  });

  // People in more than one household. Needs the service-role key to clean up the household it makes.
  it.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY)("someone in two households reads both, and other people can't read or write the second", async () => {
    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: second, error } = await dad.client.rpc("create_household", { p_name: "RLS second household", p_display_name: "Dad", p_initials: "DR" });
    expect(error).toBeNull();
    try {
      const { data: dadSees } = await dad.client.from("households").select("id").in("id", [HOUSEHOLD, second as string]);
      expect(dadSees).toHaveLength(2);
      expect((await mom.client.from("households").select("id").eq("id", second as string)).data).toEqual([]);
      const { error: momWrites } = await mom.client.from("profiles").insert({ household_id: second as string, name: "Not Mom's", color: "blue", care_stage: "child" });
      expect(momWrites).not.toBeNull();
    } finally {
      await service.from("households").delete().eq("id", second as string);
    }
  });
});
