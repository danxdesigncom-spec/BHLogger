import { describe, it, expect } from "vitest";
import { mergeEntries, type LocalEntry } from "@/lib/data/types";
import { nextSessionState } from "@/lib/install";

const entry = (id: string, at: string, sync: LocalEntry["_sync"] = "synced", profile = "leo", type = "bathroom"): LocalEntry => ({
  id, household_id: "h", profile_id: profile, type, occurred_at: at, tz: "UTC", ended_at: null, data: {}, note: null,
  flagged_for_doctor: false, logged_by: "u", logged_by_name: "Mom", logged_by_initials: "MR", created_at: at, updated_at: at,
  deleted_at: null, schema_version: 1, _sync: sync,
});

describe("AT-08 outbox merge", () => {
  it("shows pending entries with their waiting-to-sync state", () => {
    const pending = [entry("p1", "2026-10-26T10:00:00Z", "pending"), entry("p2", "2026-10-26T11:00:00Z", "pending")];
    const merged = mergeEntries(pending, [entry("s1", "2026-10-26T09:00:00Z")], {});
    expect(merged.map((e) => e.id)).toEqual(["p2", "p1", "s1"]);
    expect(merged.filter((e) => e._sync === "pending")).toHaveLength(2);
  });

  it("never duplicates an entry once the server has it (sync exactly once)", () => {
    const pending = [entry("same", "2026-10-26T10:00:00Z", "pending")];
    const merged = mergeEntries(pending, [entry("same", "2026-10-26T10:00:00Z")], {});
    expect(merged).toHaveLength(1);
    expect(merged[0]._sync).toBe("synced");
  });

  it("applies the same profile, type and date filters to pending entries", () => {
    const pending = [
      entry("a", "2026-10-26T10:00:00Z", "pending", "maya"),
      entry("b", "2026-10-26T10:00:00Z", "pending", "leo", "mood"),
      entry("c", "2026-10-20T10:00:00Z", "pending"),
      entry("d", "2026-10-26T10:00:00Z", "pending"),
    ];
    const merged = mergeEntries(pending, [], { profileId: "leo", types: ["bathroom"], from: "2026-10-25T00:00:00Z" });
    expect(merged.map((e) => e.id)).toEqual(["d"]);
  });

  it("leaves the Recently deleted list alone", () => {
    expect(mergeEntries([entry("p", "2026-10-26T10:00:00Z", "pending")], [], { deleted: "only" })).toEqual([]);
  });
});

describe("install prompt sessions", () => {
  it("counts a new session after a 30-minute gap", () => {
    let s = { count: 0, last: 0 };
    s = nextSessionState(s, 1_000_000);
    s = nextSessionState(s, 1_000_000 + 10 * 60_000);
    expect(s.count).toBe(1);
    s = nextSessionState(s, 1_000_000 + 60 * 60_000);
    s = nextSessionState(s, 1_000_000 + 120 * 60_000);
    expect(s.count).toBe(3);
  });
});
