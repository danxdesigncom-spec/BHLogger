import { existsSync, readFileSync } from "node:fs";
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

// People in more than one household (ACC-07): accepting a second invite opens that household, and the
// profile switcher goes back. Uses the "Lee Family (e2e)" household that `pnpm e2e:sessions` resets;
// its invite works once, so run that again before rerunning this.
const FIXTURE = "tests/.auth/fixture.json";
const fixture = existsSync(FIXTURE)
  ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as { secondHouseholdName: string; inviteToken: string })
  : null;

test.describe("More than one household (live)", () => {
  test.skip(!DAD || !fixture, "Needs Dad's session and the fixture: run `pnpm e2e:sessions`, then set E2E_STORAGE_STATE_2");

  test("accepting a second invite opens that household, and the switcher goes back", async ({ browser }) => {
    const dad = await browser.newContext({ storageState: DAD });
    const page = await dad.newPage();

    await page.goto(`/invite/${fixture!.inviteToken}`);
    await page.getByRole("textbox").first().fill("Dad");
    await page.getByRole("button", { name: "Join household" }).click();

    await expect(page.getByRole("heading", { name: "How’s Ava doing?" })).toBeVisible();
    await expect(page.getByText(fixture!.secondHouseholdName, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /^Switch profile/ }).click();
    await expect(page.getByRole("dialog").getByText("Your other households")).toBeVisible();
    await page.getByRole("button", { name: "Switch to Rodriguez Family" }).click();
    await expect(page.getByRole("heading", { name: /How’s (Leo|Maya) doing\?/ })).toBeVisible();
    await expect(page.getByText("Rodriguez Family", { exact: true })).toBeVisible();

    await dad.close();
  });
});
