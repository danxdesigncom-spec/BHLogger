import { cookies } from "next/headers";

export const DEMO_OVERRIDES_COOKIE = "bl-demo-overrides";

/** Household and profile edits made in demo mode. Kept small: settings and profile fields only. */
export interface DemoOverrides {
  household?: { name?: string; settings?: Record<string, unknown> };
  profiles?: Record<string, Record<string, unknown>>;
}

export async function readDemoOverrides(): Promise<DemoOverrides> {
  try {
    return JSON.parse((await cookies()).get(DEMO_OVERRIDES_COOKIE)?.value ?? "{}");
  } catch {
    return {};
  }
}
