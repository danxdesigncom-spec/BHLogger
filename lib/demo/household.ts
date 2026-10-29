import type { MemberSummary, ProfileSummary } from "@/lib/context/household-provider";
import { toProfileSummary } from "@/lib/profiles";
import { generateHouseholdData, SEED_IDS } from "@/lib/demo/generate";
import type { DemoOverrides } from "@/lib/demo/overrides";

export const DEMO_HOUSEHOLD_ID = SEED_IDS.household;

export function demoHousehold(overrides: DemoOverrides = {}): {
  name: string;
  settings: unknown;
  profiles: ProfileSummary[];
  archivedProfiles: ProfileSummary[];
  members: MemberSummary[];
  currentMember: MemberSummary;
} {
  const data = generateHouseholdData({ anchor: new Date(), tz: "UTC", days: 1 });
  const members: MemberSummary[] = data.members.map((m) => ({
    id: m.id,
    userId: m.user_id,
    displayName: m.display_name,
    initials: m.initials,
    role: m.role,
    // S22/S25 story (D12): Grandma sees Leo only.
    restrictedProfileIds: m.user_id === SEED_IDS.grandma ? [SEED_IDS.leo] : [],
    accessFrom: m.access_from,
  }));

  const all = data.profiles.flatMap((p) => {
    const o = overrides.profiles?.[p.id] ?? {};
    const { archived, deleted, ...fields } = o as { archived?: boolean; deleted?: boolean } & Record<string, unknown>;
    // SET-07 in the demo: a deleted profile stays out until the demo is exited.
    return deleted ? [] : [{ summary: toProfileSummary({ ...p, ...fields } as typeof p), archived: !!archived }];
  });

  return {
    name: overrides.household?.name ?? data.household.name,
    settings: { ...(data.household.settings as Record<string, unknown>), ...overrides.household?.settings },
    profiles: all.filter((p) => !p.archived).map((p) => p.summary),
    archivedProfiles: all.filter((p) => p.archived).map((p) => p.summary),
    members,
    // The demo visitor plays Mom, the household admin.
    currentMember: members.find((m) => m.userId === SEED_IDS.mom)!,
  };
}
