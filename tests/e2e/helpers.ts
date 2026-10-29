import { expect, type Page } from "@playwright/test";

/** The mockup story's moment: Mon, Oct 26, 2026, 7:05 PM (25 minutes before Melatonin is due). */
export const STORY = new Date(2026, 9, 26, 19, 5);

/**
 * Enters demo mode ("Continue without saving"). It needs no account; the Leo + Maya story is generated
 * in this browser, anchored to the page clock, so `at` pins the story to a known moment.
 */
export async function enterDemo(page: Page, opts: { at?: Date } = {}) {
  if (opts.at) await page.clock.install({ time: opts.at });
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "Continue without saving" }).click();
  // Night mode (SET-03) titles Home "Quiet hours".
  await expect(page.getByRole("heading", { name: /How.s .+ doing\?|Quiet hours/ })).toBeVisible({ timeout: 30_000 });
}

/** S26/S27: 3:05 AM the night after the story's day. */
export const STORY_NIGHT = new Date(2026, 9, 27, 3, 5);

/** Sets this device's night mode cookie (SET-03) before the app reads it. */
export async function setNightCookie(page: Page, value: { auto?: boolean; from?: string; to?: string; override?: { on: boolean; until: string | null } | null }) {
  const night = { auto: false, from: "20:00", to: "06:00", override: null, ...value };
  await page.context().addCookies([{ name: "bl-night", value: encodeURIComponent(JSON.stringify(night)), url: "http://localhost:3000" }]);
}

export async function switchTo(page: Page, name: "Leo" | "Maya") {
  const heading = page.getByRole("heading", { name: /How.s .+ doing\?/ });
  if ((await heading.textContent())?.includes(name)) return;
  await page.getByRole("button", { name: `Switch to ${name}` }).click();
  await expect(page.getByRole("heading", { name: `How’s ${name} doing?` })).toBeVisible();
}

export function logSheet(page: Page) {
  return page.getByRole("dialog");
}
