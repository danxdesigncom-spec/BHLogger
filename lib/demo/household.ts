import type { MemberSummary, ProfileSummary } from "@/lib/context/household-provider";
import { toProfileSummary } from "@/lib/profiles";
import { generateHouseholdData, SEED_IDS } from "@/lib/demo/generate";

export const DEMO_HOUSEHOLD_ID = SEED_IDS.household;

export function demoHousehold(): {
  name: string;
  settings: unknown;
  profiles: ProfileSummary[];
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
    restrictedProfileIds: [],
    accessFrom: m.access_from,
  }));
  return {
    name: data.household.name,
    settings: data.household.settings,
    profiles: data.profiles.map(toProfileSummary),
    members,
    // The demo visitor plays Mom, the household admin.
    currentMember: members.find((m) => m.userId === SEED_IDS.mom)!,
  };
}
