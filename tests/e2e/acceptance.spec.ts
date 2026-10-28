import { test, expect } from "@playwright/test";
import { enterDemo, logSheet, STORY, switchTo } from "./helpers";

// PRD section 13 acceptance tests, run in demo mode (no account needed).
// AT-08 (offline sync) and AT-09 (database role enforcement) need a live Supabase project: see offline.spec.ts.

test.describe("Acceptance tests (demo mode)", () => {
  test("AT-01: wet diaper in three taps", async ({ page }) => {
    await enterDemo(page);
    await switchTo(page, "Maya");
    await page.getByRole("button", { name: /^Diaper / }).click();
    const sheet = logSheet(page);
    await sheet.getByRole("radio", { name: "Wet" }).click();
    await sheet.getByRole("button", { name: "Save" }).click();

    const toast = page.getByRole("status").filter({ hasText: "Wet diaper logged for Maya" });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Diaper\s+Wet · just now/ })).toBeVisible();
  });

  test("AT-02: Undo removes the entry", async ({ page }) => {
    await enterDemo(page);
    await switchTo(page, "Leo");
    await page.getByRole("button", { name: /^Mood / }).click();
    await logSheet(page).getByRole("radio", { name: "Great" }).click();
    await logSheet(page).getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: /^Mood\s+Great · just now/ })).toBeVisible();

    await page.getByRole("status").filter({ hasText: "logged for Leo" }).getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: /^Mood\s+Great · just now/ })).toHaveCount(0);
  });

  test("AT-03: backdate 30 minutes and keep timeline order", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.getByRole("button", { name: /^Bathroom / }).click();
    const sheet = logSheet(page);
    await sheet.getByRole("radio", { name: "Pee" }).click();
    await sheet.getByRole("button", { name: /^Time: now/ }).click();
    await sheet.getByRole("menuitemradio", { name: "30 min ago" }).click();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "logged for Leo" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/timeline");
    const today = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Today/ }) });
    await expect(today.getByText("6:35 PM")).toBeVisible();
    const times = await today.locator("button span.tabular-nums").allTextContents();
    expect(times).toContain("6:35 PM");
    const minutes = times.map((t) => {
      const [, h, m, ap] = t.match(/(\d+):(\d+) (AM|PM)/)!;
      return ((Number(h) % 12) + (ap === "PM" ? 12 : 0)) * 60 + Number(m);
    });
    expect(minutes).toEqual([...minutes].sort((a, b) => b - a));
  });

  test("AT-04: duplicate-dose guard", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.goto("/meds");
    await page.getByRole("button", { name: /Ibuprofen \(children's\)/ }).click();
    await logSheet(page).getByRole("button", { name: "Save dose" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("was already given 1 h 5 min ago");
    await expect(dialog).toContainText("Dad logged 7.5 mL at 6:00 PM");
    await expect(dialog.getByRole("button", { name: "Don’t log this dose" })).toBeFocused();
    await dialog.getByRole("button", { name: "Don’t log this dose" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "logged for Leo" })).toHaveCount(0);

    await logSheet(page).getByRole("button", { name: "Save dose" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Log another dose anyway" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Ibuprofen (children's) 7.5 mL logged for Leo" })).toBeVisible();
    await expect(page).toHaveURL(/\/meds$/);

    await page.goto("/timeline");
    await expect(page.getByText("extra dose confirmed")).toHaveCount(1);
  });

  test("AT-05: a dose past its window reads Not logged until it's logged", async ({ page }) => {
    await enterDemo(page, { at: new Date(2026, 9, 26, 21, 1) });
    await switchTo(page, "Leo");
    await expect(page.getByRole("region", { name: "Melatonin not logged" })).toBeVisible();

    await page.goto("/meds");
    await expect(page.getByText("Not logged · due 7:30 PM")).toBeVisible();
    await page.getByRole("button", { name: "Give Melatonin" }).click();
    const sheet = logSheet(page);
    await sheet.getByRole("button", { name: /^Time: now/ }).click();
    await sheet.getByLabel("Custom").fill("2026-10-26T20:45");
    await sheet.getByRole("button", { name: "Save dose" }).click();

    const given = page.locator("section").filter({ has: page.getByRole("heading", { name: "Given today" }) });
    await expect(given).toContainText("Melatonin");
    await expect(given).toContainText("8:45 PM");
    await expect(page.getByText("Not logged · due 7:30 PM")).toHaveCount(0);
  });

  test("AT-06: age-appropriate stool scale", async ({ page }) => {
    await enterDemo(page);
    await switchTo(page, "Maya");
    await page.getByRole("button", { name: /^Diaper / }).click();
    await logSheet(page).getByRole("radio", { name: "Dirty" }).click();
    for (const label of ["Watery", "Soft", "Formed", "Hard"]) {
      await expect(logSheet(page).getByRole("radiogroup", { name: "Consistency" }).getByRole("radio", { name: label })).toBeVisible();
    }
    await logSheet(page).getByRole("button", { name: "Close" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Discard" }).click();

    await switchTo(page, "Leo");
    await page.getByRole("button", { name: /^Bathroom / }).click();
    await logSheet(page).getByRole("radio", { name: "BM" }).click();
    for (let t = 1; t <= 7; t++) {
      await expect(logSheet(page).getByRole("radio", { name: new RegExp(`^Type ${t}:`) })).toBeVisible();
    }
  });

  test("AT-07: pale stool shows the notice and reaches the report", async ({ page }) => {
    await enterDemo(page);
    await switchTo(page, "Maya");
    await page.getByRole("button", { name: /^Diaper / }).click();
    const sheet = logSheet(page);
    await sheet.getByRole("radio", { name: "Dirty" }).click();
    await sheet.getByRole("radio", { name: "White, pale or clay" }).click();
    const notice = sheet.getByRole("note");
    await expect(notice).toContainText("Worth mentioning to your doctor");
    await expect(notice).toContainText("Pale, white or clay-colored stool in a baby should be reported");
    await notice.getByRole("button", { name: "Flag for doctor" }).click();
    await expect(notice.getByRole("button", { name: "Flagged for doctor" })).toHaveAttribute("aria-pressed", "true");
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "logged for Maya" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/reports");
    await page.getByRole("radio", { name: "Maya" }).click();
    await page.getByRole("radio", { name: "7 days" }).click();
    await page.getByRole("link", { name: "Preview PDF" }).click();
    const flagged = page.locator("section").filter({ has: page.getByRole("heading", { name: "Flagged for the doctor" }) });
    await expect(flagged).toContainText("Pale stool");
  });

  test("AT-10: days without a BM", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await expect(page.getByRole("region", { name: "3 days since Leo's last BM" })).toBeVisible();
    await page.goto("/insights");
    await expect(page.getByRole("link", { name: /Bathroom\s+3 days\s+since last BM/ })).toBeVisible();
  });

  test("AT-12: medication change marker on the mood chart", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.goto("/insights/trends?module=mood");
    await page.getByRole("radio", { name: "30 days" }).click();
    const card = page.getByRole("region", { name: /^Mood: / });
    await expect(card.locator(".recharts-reference-line text").filter({ hasText: "Melatonin dose changed" })).toBeVisible();
    await expect(card.getByText("Melatonin dose changed · Oct 1")).toBeVisible();
  });

  test("AT-14: switching profiles changes accent, header and sheet title", async ({ page }) => {
    await enterDemo(page);
    await switchTo(page, "Maya");
    await expect(page.locator("html")).toHaveAttribute("data-profile-color", "teal");
    await switchTo(page, "Leo");
    await expect(page.locator("html")).toHaveAttribute("data-profile-color", "violet");
    await expect(page.getByRole("button", { name: "Switch profile. Current profile: Leo" })).toBeVisible();
    await page.getByRole("button", { name: /^Mood / }).click();
    await expect(logSheet(page)).toContainText("for Leo");
  });
});
