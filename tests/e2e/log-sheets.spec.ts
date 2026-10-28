import { test, expect } from "@playwright/test";

// M5 e2e tests: Full module log sheets.
// Requires a running dev server and the Rodriguez Family seed (pnpm db:seed).
// Skipped in CI until Supabase is configured.

test.describe("Log sheets (M5)", () => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "Supabase not configured");

  // AT-01: Wet diaper in 3 taps or fewer
  // Leo is a child (toilet). Maya is a baby (diaper).
  // We switch to Maya (baby), open the Diaper tile, tap "Wet", tap Save = 3 taps.
  test("AT-01: wet diaper logged in 3 taps", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /How's/ })).toBeVisible();

    // Switch to Maya (baby profile) if not already active
    const profilePill = page.getByRole("button", { name: /Maya|Active profile/i }).first();
    if (await profilePill.count() > 0) {
      await profilePill.click();
      const mayaOption = page.getByRole("button", { name: /Maya/i });
      if (await mayaOption.count() > 0) await mayaOption.click();
    }

    // Tap 1: open Diaper tile
    const diaperTile = page.getByRole("button", { name: /Diaper/i }).first();
    await expect(diaperTile).toBeVisible();
    await diaperTile.click();

    // Confirm diaper sheet opened
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Tap 2: select "Wet"
    const wetBtn = dialog.getByRole("button", { name: /^Wet$/i });
    await expect(wetBtn).toBeVisible();
    await wetBtn.click();

    // Tap 3: Save
    const saveBtn = dialog.getByRole("button", { name: "Save" });
    await saveBtn.click();

    // Confirm toast appeared with profile name
    await expect(page.getByRole("status")).toContainText(/Maya/i);
  });

  // AT-06: Age-appropriate consistency scale shown
  // For Leo (child/toilet) → Bristol 1-7 should appear after selecting BM.
  // For Maya (baby/diaper) → Infant 4-point scale should appear after selecting Dirty.
  test("AT-06: age-appropriate consistency scale shown", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /How's/ })).toBeVisible();

    // ── Leo (toilet user) ──
    const leoBtn = page.getByRole("button", { name: /Leo/i }).first();
    if (await leoBtn.count() > 0) await leoBtn.click();

    const bathroomTile = page.getByRole("button", { name: /Bathroom/i }).first();
    await bathroomTile.click();
    const dialog = page.getByRole("dialog");

    // Select BM → Bristol scale should appear
    const bmBtn = dialog.getByRole("button", { name: /^BM$/i });
    await bmBtn.click();
    await expect(dialog.getByText(/Bristol scale/i)).toBeVisible();

    // Bristol tile 4 (Smooth) should be present
    await expect(dialog.getByRole("button", { name: /Smooth/i })).toBeVisible();

    // Close
    await dialog.getByRole("button", { name: /Close/i }).click();

    // ── Maya (baby/diaper) ──
    const mayaBtn = page.getByRole("button", { name: /Maya/i }).first();
    if (await mayaBtn.count() > 0) await mayaBtn.click();

    const diaperTile = page.getByRole("button", { name: /Diaper/i }).first();
    await diaperTile.click();
    const dialog2 = page.getByRole("dialog");

    // Select Dirty → infant scale should appear
    const dirtyBtn = dialog2.getByRole("button", { name: /^Dirty$/i });
    await dirtyBtn.click();
    await expect(dialog2.getByText(/Infant scale/i)).toBeVisible();

    // Infant consistency options: Watery, Soft, Formed, Hard
    await expect(dialog2.getByRole("button", { name: /Watery/i })).toBeVisible();
    await expect(dialog2.getByRole("button", { name: /Soft/i })).toBeVisible();

    await dialog2.getByRole("button", { name: /Close/i }).click();
  });

  // AT-07: Pale stool triggers calm notice and Flag for doctor
  test("AT-07: pale stool color triggers calm notice", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /How's/ })).toBeVisible();

    // Use either profile — pale triggers for both
    const bathroomTile = page.getByRole("button", { name: /Bathroom|Diaper/i }).first();
    await bathroomTile.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Select a stool-inclusive type first (BM or Dirty/Both)
    const bmOrDirty = dialog.getByRole("button", { name: /^BM$|^Dirty$/i }).first();
    await bmOrDirty.click();

    // Select "Pale" color swatch
    const paleBtn = dialog.getByRole("button", { name: /Pale/i });
    await expect(paleBtn).toBeVisible();
    await paleBtn.click();

    // Calm notice should appear
    await expect(dialog.getByRole("note")).toBeVisible();
    await expect(dialog.getByText(/Worth a call to/i)).toBeVisible();

    // "Flag for doctor" button should be in the notice
    const flagBtn = dialog.getByRole("button", { name: /Flag for doctor/i });
    await expect(flagBtn).toBeVisible();

    // Clicking it should not throw (sets flagged state)
    await flagBtn.click();
    await expect(dialog.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
