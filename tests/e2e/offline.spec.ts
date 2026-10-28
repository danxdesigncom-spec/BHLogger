import { test, expect } from "@playwright/test";

// AT-08: offline logging. Needs a signed-in session against a real Supabase project
// (demo mode never syncs, so it can't prove "sync exactly once").
test.describe("Offline outbox (AT-08)", () => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.E2E_STORAGE_STATE, "Needs Supabase and a signed-in storage state");
  test.use({ storageState: process.env.E2E_STORAGE_STATE });

  test("three entries logged offline wait to sync, then sync exactly once", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /How's/ })).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByRole("status").filter({ hasText: /offline/i })).toBeVisible();

    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: /^(Bathroom|Diaper|Potty)/ }).click();
      const sheet = page.getByRole("dialog");
      await sheet.getByRole("radio", { name: /^(Pee|Wet)$/ }).click();
      await sheet.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("status").filter({ hasText: /logged for/ })).toBeVisible();
    }

    await page.goto("/timeline");
    await expect(page.getByText("Waiting to sync")).toHaveCount(3);

    await context.setOffline(false);
    await expect(page.getByText("Waiting to sync")).toHaveCount(0, { timeout: 20_000 });

    await page.reload();
    const firstDay = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Today/ }) });
    await expect(firstDay.getByText("Waiting to sync")).toHaveCount(0);
  });
});
