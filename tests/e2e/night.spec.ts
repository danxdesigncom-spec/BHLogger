import { test, expect } from "@playwright/test";
import { enterDemo, logSheet, setNightCookie, STORY, STORY_NIGHT } from "./helpers";

// M12d: night mode (SET-03, S26 and S27), in demo mode. The night mockups are set at 3:05 AM.
const html = (page: import("@playwright/test").Page) => page.locator("html");

async function showMaya(page: import("@playwright/test").Page) {
  const pill = page.getByRole("button", { name: /^Switch profile/ });
  if (!(await pill.getAttribute("aria-label"))?.includes("Maya")) await page.getByRole("button", { name: "Switch to Maya" }).click();
  await expect(pill).toHaveAccessibleName("Switch profile. Current profile: Maya");
}

test.describe("Night mode (M12d)", () => {
  test("S26: automatic hours turn it on, with Quiet hours, the moon button and One tap", async ({ page }) => {
    await setNightCookie(page, { auto: true });
    await enterDemo(page, { at: STORY_NIGHT });
    await showMaya(page);

    await expect(html(page)).toHaveAttribute("data-theme", "night");
    await expect(page.getByRole("heading", { level: 1, name: "Quiet hours" })).toBeVisible();
    await expect(page.getByText("Night mode is on until 6:00 AM")).toBeVisible();
    await expect(page.getByRole("button", { name: "Turn off night mode" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Diaper\s+Wet · 10:35 PM/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Medication\s+Nothing due tonight/ })).toBeVisible();
    const oneTap = page.getByRole("region", { name: "One tap" });
    await expect(oneTap.getByRole("button", { name: "Bottle 4 oz" })).toBeVisible();
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", /#15110e/i);
  });

  test("S27: the feeding sheet at night says the time and the last feed", async ({ page }) => {
    await setNightCookie(page, { auto: true });
    await enterDemo(page, { at: STORY_NIGHT });
    await showMaya(page);
    await page.getByRole("button", { name: /^Feeding/ }).click();

    const sheet = logSheet(page);
    await expect(sheet.getByText("for Maya · 3:05 AM")).toBeVisible();
    await sheet.getByRole("radio", { name: /Bottle/ }).click();
    await expect(sheet.getByText("Same as last feed")).toBeVisible();
    await sheet.getByRole("radio", { name: "3 oz" }).click();
    await expect(sheet.getByText("Last feed 10:40 PM · 4 oz")).toBeVisible();
  });

  test("SET-03: the moon button turns it off until the next window starts", async ({ page }) => {
    await setNightCookie(page, { auto: true });
    await enterDemo(page, { at: STORY_NIGHT });
    await showMaya(page);

    await page.getByRole("button", { name: "Turn off night mode" }).click();
    await expect(html(page)).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("heading", { level: 1, name: "How’s Maya doing?" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Switch profile/ })).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: "Night mode is off. It comes back on at 8 PM." })).toBeAttached();
    await expect(page.getByRole("region", { name: "Quick taps" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "How’s Maya doing?" })).toBeVisible();
    await expect(html(page)).toHaveAttribute("data-theme", "light");

    // The next evening's window brings it back on its own, without a reload.
    await page.clock.fastForward("17:00:00");
    await expect(html(page)).toHaveAttribute("data-theme", "night", { timeout: 10_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Quiet hours" })).toBeVisible();
  });

  test("SET-03: the head script picks night before the app loads", async ({ page }) => {
    await setNightCookie(page, { auto: true });
    await enterDemo(page, { at: STORY_NIGHT });
    // With the app's scripts blocked, only the inline head script can set the theme.
    await page.route(/\/_next\/static\/.*\.js/, (route) => route.abort());
    await page.goto("/more");
    await expect(html(page)).toHaveAttribute("data-theme", "night");
  });

  test("SET-03: the switch and automatic hours in Theme and night mode", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await page.goto("/more");
    await page.getByRole("link", { name: /Theme and night mode\s+Light/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Theme and night mode" })).toBeVisible();

    const now = page.getByRole("switch", { name: "Turn on now" });
    const auto = page.getByRole("switch", { name: "Turn on automatically" });
    await expect(now).not.toBeChecked();
    await expect(auto).not.toBeChecked();
    await expect(page.getByRole("radiogroup", { name: "Starts at" })).toHaveCount(0);

    await now.check();
    await expect(html(page)).toHaveAttribute("data-theme", "night");
    await expect(now).toHaveAccessibleDescription("On until you turn it off");

    // 7:05 PM is before the 8 PM default, so turning on automatic hours keeps it on until the window ends.
    await auto.check();
    await expect(page.getByText("Every night from 8 PM to 6 AM")).toBeVisible();
    await expect(now).toHaveAccessibleDescription("On until 6:00 AM");
    await now.uncheck();
    await expect(html(page)).toHaveAttribute("data-theme", "light");
    await expect(now).toHaveAccessibleDescription("Comes on at 8 PM");

    // A window that already started turns it on right away.
    await page.getByRole("radiogroup", { name: "Starts at" }).getByRole("radio", { name: "7 PM" }).click();
    await expect(html(page)).toHaveAttribute("data-theme", "night");
    await expect(page.getByText("Every night from 7 PM to 6 AM")).toBeVisible();

    await page.getByRole("link", { name: "Back to More" }).click();
    await expect(page.getByRole("link", { name: /Theme and night mode\s+Light · Night mode on/ })).toBeVisible();
  });
});
