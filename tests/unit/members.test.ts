import { describe, it, expect } from "vitest";

// Unit tests for role-enforcement logic (the guard is in lib/actions/members.ts).
// These tests exercise the pure logic in isolation, without a DB connection.

type Role = "admin" | "caregiver" | "viewer";

interface Member {
  id: string;
  role: Role;
}

function wouldLeaveNoAdmin(
  members: Member[],
  targetId: string,
  newRole?: Role,
): boolean {
  const admins = members.filter((m) => m.role === "admin");
  if (admins.length !== 1) return false;
  const isOnlyAdmin = admins[0].id === targetId;
  if (!isOnlyAdmin) return false;
  // removal: always leaves no admin
  if (newRole === undefined) return true;
  // demotion
  return newRole !== "admin";
}

const MEMBERS: Member[] = [
  { id: "m1", role: "admin" },
  { id: "m2", role: "caregiver" },
  { id: "m3", role: "viewer" },
];

describe("last-admin guard", () => {
  it("allows removing a non-admin member", () => {
    expect(wouldLeaveNoAdmin(MEMBERS, "m2")).toBe(false);
  });

  it("blocks removing the only admin", () => {
    expect(wouldLeaveNoAdmin(MEMBERS, "m1")).toBe(true);
  });

  it("allows removing one admin when two admins exist", () => {
    const two = [
      { id: "m1", role: "admin" as Role },
      { id: "m4", role: "admin" as Role },
      { id: "m2", role: "caregiver" as Role },
    ];
    expect(wouldLeaveNoAdmin(two, "m1")).toBe(false);
  });

  it("blocks demoting the only admin to caregiver", () => {
    expect(wouldLeaveNoAdmin(MEMBERS, "m1", "caregiver")).toBe(true);
  });

  it("allows demoting one admin when another exists", () => {
    const two = [
      { id: "m1", role: "admin" as Role },
      { id: "m4", role: "admin" as Role },
    ];
    expect(wouldLeaveNoAdmin(two, "m1", "caregiver")).toBe(false);
  });

  it("allows promoting a caregiver to admin", () => {
    expect(wouldLeaveNoAdmin(MEMBERS, "m2", "admin")).toBe(false);
  });
});

describe("invite expiry check", () => {
  function isInviteValid(expiresAt: Date, acceptedAt: Date | null): "valid" | "expired" | "accepted" {
    if (acceptedAt !== null) return "accepted";
    if (expiresAt <= new Date()) return "expired";
    return "valid";
  }

  it("returns valid for a future expiry with no acceptance", () => {
    const future = new Date(Date.now() + 86400 * 1000);
    expect(isInviteValid(future, null)).toBe("valid");
  });

  it("returns expired for a past expiry", () => {
    const past = new Date(Date.now() - 1000);
    expect(isInviteValid(past, null)).toBe("expired");
  });

  it("returns accepted when accepted_at is set, even if not expired", () => {
    const future = new Date(Date.now() + 86400 * 1000);
    expect(isInviteValid(future, new Date())).toBe("accepted");
  });
});
