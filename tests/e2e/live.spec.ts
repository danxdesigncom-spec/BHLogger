import { test, expect } from "@playwright/test";

// AT-02 across two devices: a second caregiver sees the entry arrive and then disappear when it's undone.
// Needs a real project with the seed story and two signed-in sessions (`pnpm e2e:sessions`):
//   E2E_STORAGE_STATE=tests/.auth/mom.json E2E_STORAGE_STATE_2=tests/.auth/dad.json pnpm test:e2e live.spec.ts
const MOM = process.env.E2E_STORAGE_STATE;
const DAD = process.env.E2E_STORAGE_STATE_2;

test.describe("Two caregivers at once (AT-02, live)", () => {
  test.skip(!MOM || !DAD, "Needs two signed-in sessions: run `pnpm e2e:sessions`, then set E2E_STORAGE_STATE and E2E_STORAGE_STATE_2");

  test("Undo on one phone removes the entry from the other within seconds", async ({ browser }) => {
    const mom = await browser.newContext({ storageState: MOM });
    const dad = await browser.newContext({ storageState: DAD });
    const momPage = await mom.newPage();
    const dadPage = await dad.newPage();

    await dadPage.goto("/timeline");
    await expect(dadPage.getByRole("heading", { name: "Timeline", level: 1 })).toBeVisible();
    const great = dadPage.getByRole("main").getByRole("button", { name: /Great/ });
    const before = await great.count();

    await momPage.goto("/");
    await momPage.getByRole("button", { name: /^Mood / }).click();
    await momPage.getByRole("dialog").getByRole("radio", { name: "Great" }).click();
    await momPage.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    const toast = momPage.getByRole("status").filter({ hasText: /logged for/ });
    await expect(toast).toBeVisible();

    // Realtime brings it to Dad's timeline, then Undo (within the toast's 6 s) takes it away again.
    await expect(great).toHaveCount(before + 1, { timeout: 10_000 });
    await toast.getByRole("button", { name: "Undo" }).click();
    await expect(great).toHaveCount(before, { timeout: 10_000 });

    await mom.close();
    await dad.close();
  });
});
