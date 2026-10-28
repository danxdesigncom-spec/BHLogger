import { test, expect } from "@playwright/test";
import { enterDemo, logSheet, STORY, switchTo } from "./helpers";

// M12a: quick taps (QL-09), "Same as last time" (QL-10), timers (QL-11) and tile order (QL-12), in demo mode.
const LEO = "a1000000-0000-0000-0000-000000000008";

test.describe("Quick logging (M12a)", () => {
  test("QL-09: a quick tap logs in one tap with Undo", async ({ page }) => {
    await enterDemo(page);
    await switchTo(page, "Leo");
    const quick = page.getByRole("region", { name: "Quick taps" });
    await quick.getByRole("button", { name: "Pee", exact: true }).click();

    const toast = page.getByRole("status").filter({ hasText: "Pee logged for Leo" });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Bathroom\s+Pee · just now/ })).toBeVisible();
  });

  test("QL-09 + MED-07: a medication quick tap still runs the duplicate-dose guard", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.getByRole("region", { name: "Quick taps" }).getByRole("button", { name: "Allergy med" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Allergy relief was already given");
    await expect(dialog.getByRole("button", { name: "Don’t log this dose" })).toBeFocused();
    await dialog.getByRole("button", { name: "Don’t log this dose" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "logged for Leo" })).toHaveCount(0);
  });

  test("QL-09: any entry can be added as a quick tap", async ({ page }) => {
    await enterDemo(page);
    await switchTo(page, "Leo");
    await expect(page.getByRole("region", { name: "Quick taps" }).getByRole("button")).toHaveCount(3);

    await page.getByRole("link", { name: "Timeline" }).click();
    await page.getByRole("radiogroup", { name: "Filter by module" }).getByRole("radio", { name: "Mood" }).click();
    await page.getByRole("main").locator("section button").first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Add to quick taps" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "In quick taps" })).toBeDisabled();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

    await page.getByRole("link", { name: "Log" }).click();
    await expect(page.getByRole("region", { name: "Quick taps" }).getByRole("button")).toHaveCount(4);
  });

  test("QL-10: Same as last time repeats the last entry now", async ({ page }) => {
    await enterDemo(page);
    await switchTo(page, "Leo");
    await page.getByRole("button", { name: /^Bathroom / }).click();
    await logSheet(page).getByRole("button", { name: /^Same as last time · / }).click();

    await expect(page.getByRole("status").filter({ hasText: "logged for Leo" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Bathroom\s+.+ · just now/ })).toBeVisible();
  });

  test("QL-11: an activity timer survives on Home and saves its duration", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.getByRole("button", { name: /^Activity / }).click();
    const sheet = logSheet(page);
    await sheet.getByRole("radiogroup", { name: "Activity" }).getByRole("radio").first().click();
    await sheet.getByRole("button", { name: "Start timer" }).click();
    await expect(sheet).toHaveCount(0);

    const timers = page.getByRole("region", { name: "Running timers" });
    await expect(timers).toContainText("for Leo");
    await page.reload();
    await expect(timers).toContainText("for Leo");

    await page.clock.fastForward("15:00");
    await timers.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByRole("status").filter({ hasText: "logged for Leo" })).toBeVisible();
    await expect(timers).toHaveCount(0);

    await page.getByRole("link", { name: "Timeline" }).click();
    await page.getByRole("radiogroup", { name: "Filter by module" }).getByRole("radio", { name: "Activity" }).click();
    await expect(page.getByRole("main").locator("section button").first()).toContainText("15 min");
  });

  test("QL-12: tile order follows the profile's settings", async ({ page }) => {
    await enterDemo(page);
    await switchTo(page, "Leo");
    await page.goto(`/more/profiles/${LEO}`);
    await page.getByRole("button", { name: "Move Mood and behaviors up" }).click();
    await expect(page.getByRole("status").filter({ hasText: "moved up on Home" })).toBeVisible();

    await page.getByRole("link", { name: "Log" }).click();
    const tiles = page.getByRole("navigation", { name: "Log for Leo" }).getByRole("button");
    await expect(tiles.nth(0)).toHaveAccessibleName(/^Bathroom/);
    await expect(tiles.nth(1)).toHaveAccessibleName(/^Mood/);
    await expect(tiles.nth(2)).toHaveAccessibleName(/^Eating/);
  });
});
