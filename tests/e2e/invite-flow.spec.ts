import { test, expect } from "@playwright/test";

// End-to-end: invite flow (AT-09 equivalent).
// The signed-in parts need a real project with the seed story and an admin's session (`pnpm e2e:sessions`,
// then E2E_STORAGE_STATE=tests/.auth/mom.json). Without it they skip; the signed-out checks always run.
const SIGNED_IN = process.env.E2E_STORAGE_STATE;

test.describe("invite flow", () => {
  test.skip(!SIGNED_IN, "Needs a signed-in admin: run `pnpm e2e:sessions` and set E2E_STORAGE_STATE");
  test.use({ storageState: SIGNED_IN });

  test("admin can open invite sheet", async ({ page }) => {
    // This test assumes the Rodriguez Family seed is loaded.
    // Mom (admin) navigates to More → Invite a caregiver.
    await page.goto("/more");
    await expect(page.getByText("Caregivers")).toBeVisible();
    await page.getByRole("link", { name: "Invite a caregiver" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Invite a caregiver")).toBeVisible();
  });

  test("invite sheet has email, role and profile fields", async ({ page }) => {
    await page.goto("/more/caregivers/invite");
    await expect(page.getByLabel("Their email")).toBeVisible();
    await expect(page.getByText("What can they do?")).toBeVisible();
    await expect(page.getByText("Who can they see?")).toBeVisible();
  });

  test("non-admin does not see Invite a caregiver", async ({ page }) => {
    // This test would require signing in as a caregiver, which is not yet
    // automatable without a test user setup. Mark as pending.
    test.fixme();
  });

  test("S24 shows valid invite preview", async ({ page }) => {
    // Requires a known invite token in the seed. Add after db:seed is run.
    test.fixme();
  });

  test("expired token shows expired state", async ({ page }) => {
    await page.goto("/invite/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText(/isn't valid|expired/i)).toBeVisible();
  });
});

test.describe("More tab", () => {
  test.skip(!SIGNED_IN, "Needs a signed-in admin: run `pnpm e2e:sessions` and set E2E_STORAGE_STATE");
  test.use({ storageState: SIGNED_IN });

  test("shows people and caregivers sections", async ({ page }) => {
    await page.goto("/more");
    await expect(page.getByRole("heading", { name: "People you care for" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Caregivers" })).toBeVisible();
  });
});

test.describe("onboarding flow", () => {
  // Signed out: no session cookies, whatever the project.

  test("new user is redirected to onboarding", async ({ page }) => {
    // Without a session, the user is redirected to login.
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("login page renders magic link form", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send magic link" })).toBeVisible();
  });
});
