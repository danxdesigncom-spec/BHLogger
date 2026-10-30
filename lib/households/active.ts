// A person can belong to more than one household (a sitter, an aide, a grandparent with two families).
// One is active on each device at a time; nothing from the others mixes in.

export const ACTIVE_HOUSEHOLD_COOKIE = "bl-active-household";

/**
 * The household this device last used, when it's still one of theirs; otherwise the one they joined most
 * recently, so accepting an invite lands in the new household (ACC-07).
 */
export function pickMembership<T extends { household_id: string; created_at: string }>(memberships: T[], chosen: string | null | undefined): T | null {
  return memberships.find((m) => m.household_id === chosen) ?? [...memberships].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

/** Another household this person belongs to, for the profile switcher and account deletion. */
export interface OtherHousehold {
  id: string;
  name: string;
  role: "admin" | "caregiver" | "viewer";
  /** The people this person can see there, in the order they were added. */
  people: { id: string; name: string; color: string; initials: string }[];
  memberCount: number;
  adminCount: number;
}

/** Sets the active household and person on this device, then reloads into it. */
export function switchHousehold(householdId: string, profileId?: string): void {
  const year = 60 * 60 * 24 * 365;
  document.cookie = `${ACTIVE_HOUSEHOLD_COOKIE}=${householdId}; path=/; max-age=${year}; SameSite=Lax`;
  if (profileId) document.cookie = `bl-active-profile=${profileId}; path=/; max-age=${year}; SameSite=Lax`;
  // A full load starts every cache, query and live-update channel fresh for the new household.
  window.location.assign("/");
}
