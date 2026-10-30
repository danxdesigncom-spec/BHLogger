// SET-07: what deleting your account does, so the screen can say it before anyone confirms.
// The database enforces the same rule, over every household, in delete_my_account().

export interface HouseholdForDeletion {
  name: string;
  memberCount: number;
  adminCount: number;
  myRole: string;
}

export type AccountDeletion =
  /** The demo: clears this browser's sample data and leaves. */
  | { kind: "demo" }
  /** A household with other members and no other admin: make someone an admin there first. */
  | { kind: "last_admin"; household: string }
  /** Households where you're the only member are deleted; you leave the rest, and your entries stay there. */
  | { kind: "go"; deletes: string[]; leaves: string[] };

export function accountDeletion(mode: "live" | "demo", households: HouseholdForDeletion[]): AccountDeletion {
  if (mode === "demo") return { kind: "demo" };
  const blocked = households.find((h) => h.memberCount > 1 && h.myRole === "admin" && h.adminCount === 1);
  if (blocked) return { kind: "last_admin", household: blocked.name };
  return {
    kind: "go",
    deletes: households.filter((h) => h.memberCount <= 1).map((h) => h.name),
    leaves: households.filter((h) => h.memberCount > 1).map((h) => h.name),
  };
}
