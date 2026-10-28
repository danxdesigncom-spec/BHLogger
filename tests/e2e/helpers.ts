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
  await expect(page.getByRole("heading", { name: /How.s .+ doing\?/ })).toBeVisible({ timeout: 30_000 });
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
