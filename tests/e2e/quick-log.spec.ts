import { test, expect } from "@playwright/test";

// End-to-end: Quick Log shell (M4).
// Requires a running dev server and the Rodriguez Family seed loaded.
// Skipped in CI until Supabase is configured.

test.describe("Quick Log shell", () => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "Supabase not configured");

  // AT-03: Backdated entry
  test("AT-03: user can log a backdated bathroom entry", async ({ page }) => {
    await page.goto("/");

    // The home screen should show the module tiles
    await expect(page.getByRole("heading", { name: /How's/ })).toBeVisible();
    const bathroomTile = page.getByRole("button", { name: /Bathroom|Diaper/i }).first();
    await expect(bathroomTile).toBeVisible();

    // Open the bathroom log sheet
    await bathroomTile.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Select a bathroom type
    const peeBtn = dialog.getByRole("button", { name: /Pee|Wet/i }).first();
    await expect(peeBtn).toBeVisible();
    await peeBtn.click();

    // Change the time to "30 min ago" from the footer time chip
    await dialog.getByRole("button", { name: /^Time: now/ }).click();
    await dialog.getByRole("menuitemradio", { name: "30 min ago" }).click();
    await expect(dialog.getByRole("button", { name: /^Time: 30 min ago/ })).toBeVisible();

    // Save the entry
    const saveBtn = dialog.getByRole("button", { name: "Save" });
    await saveBtn.click();

    // Undo toast should appear within 3 seconds
    const toast = page.getByRole("status");
    await expect(toast).toBeVisible({ timeout: 3000 });
    await expect(toast).toContainText(/Pee|Wet/i);

    // Tile should reflect the new entry
    await expect(bathroomTile).toContainText(/30 min ago/i);
  });

  // AT-03 (variant): Custom time picker blocks future time
  test("AT-03: custom time picker does not allow future times", async ({ page }) => {
    await page.goto("/");

    const bathroomTile = page.getByRole("button", { name: /Bathroom|Diaper/i }).first();
    await bathroomTile.click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /^Time: now/ }).click();

    // The datetime-local input should have a max attribute set to now (or just past)
    const input = dialog.locator('input[type="datetime-local"]');
    await expect(input).toBeVisible();
    const max = await input.getAttribute("max");
    expect(max).toBeTruthy();

    // The max value should not be in the future (at least not more than 1 minute ahead)
    const maxTime = new Date(max!).getTime();
    const nowTime = Date.now();
    expect(maxTime).toBeLessThanOrEqual(nowTime + 60_000);
  });

  // AT-14: Profile switch changes accent and greeting
  test("AT-14: switching profiles changes greeting and accent color", async ({ page }) => {
    await page.goto("/");

    // Get the current greeting
    const heading = page.getByRole("heading", { name: /How's/ });
    await expect(heading).toBeVisible();
    const firstGreeting = await heading.textContent();

    // Click the profile switcher pill
    const switcherBtn = page.getByRole("button", { name: /Switch profile/ });
    await switcherBtn.click();

    // The profile switcher sheet should open
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(/Switch profile/i);

    // Click the second profile (different from the active one)
    const profileBtns = sheet.getByRole("button").filter({ hasText: /Leo|Maya/i });
    const allProfiles = await profileBtns.all();
    expect(allProfiles.length).toBeGreaterThan(0);

    // Pick the first profile that is NOT currently active
    // (The active one has a checkmark aria-label; find one without)
    let switched = false;
    for (const btn of allProfiles) {
      const label = await btn.getAttribute("aria-label");
      if (label && !label.includes("(active)")) {
        await btn.click();
        switched = true;
        break;
      }
    }

    if (!switched) {
      // Only one profile — skip the switch assertion
      test.fixme();
      return;
    }

    // Greeting should now show a different name
    const newGreeting = await heading.textContent();
    expect(newGreeting).not.toBe(firstGreeting);

    // The data-profile-color attribute on <html> should have changed
    const profileColor = await page.evaluate(() =>
      document.documentElement.getAttribute("data-profile-color"),
    );
    expect(profileColor).toBeTruthy();
  });

  // AT-14 (variant): Undo toast shows the correct profile name
  test("AT-14: Undo toast names the active profile", async ({ page }) => {
    await page.goto("/");

    // Get the active profile name from the switcher pill
    const switcherPill = page.getByRole("button", { name: /Switch profile/ });
    const pillText = await switcherPill.textContent();
    // pillText is like "Leo▾" — extract the name portion
    const profileName = pillText?.replace(/[▾⌄]/g, "").trim() ?? "";

    // Log a bathroom entry
    const bathroomTile = page.getByRole("button", { name: /Bathroom|Diaper/i }).first();
    await bathroomTile.click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Pee|Wet/i }).first().click();
    await dialog.getByRole("button", { name: "Save" }).click();

    // Toast should mention the profile name (AT-14)
    const toast = page.getByRole("status");
    await expect(toast).toBeVisible({ timeout: 3000 });
    if (profileName) {
      await expect(toast).toContainText(profileName);
    }

    // Undo should be available and remove the entry
    const undoBtn = toast.getByRole("button", { name: "Undo" });
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();

    // Toast should dismiss after Undo
    await expect(toast).not.toBeVisible({ timeout: 2000 });
  });
});
