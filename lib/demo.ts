/**
 * Demo mode — lets you explore the UI without Supabase auth.
 * Activated by the "Continue without saving" button on the login screen.
 * The bl-demo cookie is the single source of truth; nothing is persisted.
 */

import type { ProfileSummary, MemberSummary } from "@/lib/context/household-provider";

// Never available in production builds unless explicitly opted in.
export const DEMO_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_DEMO === "1";

export const DEMO_COOKIE = "bl-demo";
export const DEMO_COOKIE_VALUE = "1";

// Fixed UUIDs so the Zod uuid() validator still passes in server actions
export const DEMO_HOUSEHOLD_ID = "00000000-0000-0000-0000-000000000001";
export const DEMO_PROFILE_LEO  = "00000000-0000-0000-0000-000000000002";
export const DEMO_PROFILE_MAYA = "00000000-0000-0000-0000-000000000003";
export const DEMO_MEMBER_ID    = "00000000-0000-0000-0000-000000000004";
export const DEMO_USER_ID      = "00000000-0000-0000-0000-000000000005";

export const DEMO_PROFILES: ProfileSummary[] = [
  { id: DEMO_PROFILE_LEO,  name: "Leo",  color: "violet", initials: "L", careStage: "child" },
  { id: DEMO_PROFILE_MAYA, name: "Maya", color: "teal",   initials: "M", careStage: "baby"  },
];

export const DEMO_CURRENT_MEMBER: MemberSummary = {
  id: DEMO_MEMBER_ID,
  userId: DEMO_USER_ID,
  displayName: "Demo",
  initials: "D",
  role: "admin",
  restrictedProfileIds: [],
  accessFrom: null,
};
