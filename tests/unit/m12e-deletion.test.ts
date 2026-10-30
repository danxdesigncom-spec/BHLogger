import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { accountDeletion } from "@/lib/account-deletion";
import { pickMembership } from "@/lib/households/active";
import { demoHousehold } from "@/lib/demo/household";
import { SEED_IDS } from "@/lib/demo/generate";
import { addReportItem, forgetReportItems, reportItems } from "@/lib/report-items";
import { forgetSavedReport, saveCardFields, saveQuestions, savedCardFields, savedQuestions, DEFAULT_CARD_FIELDS } from "@/lib/reports/templates";

// M12e: SET-07 permanent deletion. The database side (delete_profile, delete_my_account) runs in `pnpm test:rls`.
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const sql = (name: string) => readFileSync(join(MIGRATIONS, name), "utf8");

describe("SET-07 what deleting your account does", () => {
  const home = (memberCount: number, adminCount: number, myRole: string, name = "Rodriguez Family") => ({ name, memberCount, adminCount, myRole });

  it("the only member takes the household with them", () => {
    expect(accountDeletion("live", [home(1, 1, "admin")])).toEqual({ kind: "go", deletes: ["Rodriguez Family"], leaves: [] });
  });

  it("the only admin of a shared household has to make someone else an admin first", () => {
    expect(accountDeletion("live", [home(3, 1, "admin")])).toEqual({ kind: "last_admin", household: "Rodriguez Family" });
    expect(accountDeletion("live", [home(2, 2, "admin")])).toEqual({ kind: "go", deletes: [], leaves: ["Rodriguez Family"] });
  });

  it("anyone else leaves, and their entries stay", () => {
    expect(accountDeletion("live", [home(3, 1, "caregiver")])).toEqual({ kind: "go", deletes: [], leaves: ["Rodriguez Family"] });
    expect(accountDeletion("live", [home(3, 1, "viewer")])).toEqual({ kind: "go", deletes: [], leaves: ["Rodriguez Family"] });
  });

  it("covers every household: any one that would lose its only admin stops it, otherwise each is deleted or left", () => {
    const sitter = [home(3, 1, "caregiver"), home(1, 1, "admin", "Lee Family")];
    expect(accountDeletion("live", sitter)).toEqual({ kind: "go", deletes: ["Lee Family"], leaves: ["Rodriguez Family"] });
    expect(accountDeletion("live", [home(3, 1, "caregiver"), home(2, 1, "admin", "Lee Family")])).toEqual({ kind: "last_admin", household: "Lee Family" });
  });

  it("in the demo it clears the demo", () => {
    expect(accountDeletion("demo", [home(3, 1, "admin")])).toEqual({ kind: "demo" });
  });
});

describe("Which household is active (people in more than one)", () => {
  const m = (household_id: string, created_at: string) => ({ household_id, created_at });
  const both = [m("rodriguez", "2026-09-01T00:00:00Z"), m("lee", "2026-10-20T00:00:00Z")];

  it("this device's choice wins while it's still one of theirs", () => {
    expect(pickMembership(both, "rodriguez")?.household_id).toBe("rodriguez");
  });

  it("otherwise the household joined most recently, so an accepted invite lands there", () => {
    expect(pickMembership(both, undefined)?.household_id).toBe("lee");
    expect(pickMembership(both, "a-household-they-left")?.household_id).toBe("lee");
  });

  it("no memberships, no household (onboarding)", () => {
    expect(pickMembership([], "rodriguez")).toBeNull();
  });
});

describe("SET-07 deleting a profile", () => {
  it("a deleted demo profile is gone from the household, not archived", () => {
    const demo = demoHousehold({ profiles: { [SEED_IDS.maya]: { deleted: true } } });
    expect(demo.profiles.map((p) => p.name)).toEqual(["Leo"]);
    expect(demo.archivedProfiles).toEqual([]);
  });

  describe("on this device", () => {
    beforeEach(() => {
      const store = new Map<string, string>();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
      });
    });

    it("forgets the profile's report items, care card choices and questions, and keeps everyone else's", () => {
      addReportItem({ id: "chart:mood.daily", profileId: "maya", kind: "chart", title: "Mood", detail: "" });
      addReportItem({ id: "chart:mood.daily", profileId: "leo", kind: "chart", title: "Mood", detail: "" });
      saveCardFields("maya", ["contacts"]);
      saveQuestions("maya", ["Is she eating enough?"]);
      saveQuestions("leo", ["Melatonin timing?"]);

      forgetReportItems("maya");
      forgetSavedReport("maya");

      expect(reportItems("maya")).toEqual([]);
      expect(reportItems("leo")).toHaveLength(1);
      expect(savedCardFields("maya")).toEqual(DEFAULT_CARD_FIELDS);
      expect(savedQuestions("maya")).toEqual([]);
      expect(savedQuestions("leo")).toEqual(["Melatonin timing?"]);
    });
  });
});

describe("SET-07 migrations", () => {
  it("every row that points at a user says what happens when that user is deleted", () => {
    const all = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort().map(sql).join("\n");
    const columns = [...sql("20261026000001_schema.sql").matchAll(/^\s+(\w+)\s+uuid\s+not null references (auth\.users|household_members)\(id\)(?!\s+on delete)/gm)].map((m) => m[1]);
    expect(columns.sort()).toEqual(["changed_by", "changed_by", "created_by", "logged_by", "user_id"]);
    for (const col of new Set(columns)) {
      expect(all).toMatch(new RegExp(`foreign key \\(${col}\\) references (auth\\.users|household_members)\\(id\\) on delete (set null|cascade)`));
    }
  });

  it("deleting needs the database's own role checks, and anonymous callers can't run them", () => {
    const profile = sql("20261029000004_set07_delete_profile.sql");
    expect(profile).toMatch(/get_member_role\(v_hid\) is distinct from 'admin'/);
    expect(profile).toMatch(/revoke all on function delete_profile\(uuid\) from public, anon/);
    // The latest definition of delete_my_account() is the one the database runs.
    const latest = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort().map(sql).filter((m) => m.includes("create or replace function delete_my_account()")).at(-1)!;
    expect(latest).toMatch(/raise exception 'last_admin'/);
    expect(latest).toMatch(/for update/);
    expect(latest).toMatch(/revoke all on function delete_my_account\(\) from public, anon/);
    // Every household the caller is in is checked before any is changed; one picked with LIMIT 1 isn't enough.
    const code = latest.replace(/--.*$/gm, "");
    expect(code).not.toMatch(/limit 1/i);
    expect(code.indexOf("raise exception 'last_admin'")).toBeLessThan(code.indexOf("delete from households"));
  });
});

describe("non-negotiable 6: the service-role key stays on the server", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
    });

  it("only server actions read it", () => {
    const readers = ["app", "components", "lib"].flatMap((d) => files(join(process.cwd(), d))).filter((p) => readFileSync(p, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY"));
    expect(readers.map((p) => p.replace(process.cwd() + "/", "")).sort()).toEqual(["lib/actions/deletion.ts", "lib/actions/invites.ts"]);
    for (const p of readers) expect(readFileSync(p, "utf8").startsWith('"use server";')).toBe(true);
  });
});
