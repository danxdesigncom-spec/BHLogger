"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, DEMO_COOKIE_VALUE, DEMO_ENABLED } from "@/lib/demo";

export async function enterDemoMode() {
  if (!DEMO_ENABLED) redirect("/auth/login");
  const store = await cookies();
  store.set(DEMO_COOKIE, DEMO_COOKIE_VALUE, { path: "/", sameSite: "lax", httpOnly: true });
  redirect("/");
}

export async function exitDemoMode() {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  redirect("/auth/login");
}

export async function isDemoMode(): Promise<boolean> {
  if (!DEMO_ENABLED) return false;
  const store = await cookies();
  return store.get(DEMO_COOKIE)?.value === DEMO_COOKIE_VALUE;
}
