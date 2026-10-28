import { expect, type Page } from "@playwright/test";

/** Enters demo mode ("Continue without saving"), which needs no account and seeds the Leo + Maya story locally. */
export async function enterDemo(page: Page) {
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "Continue without saving" }).click();
  await expect(page.getByRole("heading", { name: /How.s .+ doing\?/ })).toBeVisible({ timeout: 20_000 });
}

export async function switchTo(page: Page, name: "Leo" | "Maya") {
  const pill = page.getByRole("button", { name: /^Switch profile\. Current profile:/ });
  if ((await pill.getAttribute("aria-label"))?.endsWith(name)) return;
  await page.getByRole("button", { name: `Switch to ${name}` }).click();
  await expect(page.getByRole("heading", { name: `How’s ${name} doing?` })).toBeVisible();
}
