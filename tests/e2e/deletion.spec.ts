import { test, expect } from "@playwright/test";
import { enterDemo, STORY } from "./helpers";

// M12e: SET-07 permanent deletion, in demo mode. The live path (delete_profile, delete_my_account and the
// service-role auth deletion) is covered by `pnpm test:rls` against a real project.

test.describe("Delete permanently (SET-07)", () => {
  test("an admin deletes a person after confirming, and the last person can't be deleted alone", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await page.getByRole("button", { name: "Switch to Maya" }).click();
    await expect(page.getByRole("heading", { name: "How’s Maya doing?" })).toBeVisible();
    await page.goto("/more/settings/data");

    await page.getByRole("button", { name: "Delete Maya" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Delete Maya permanently?" });
    await expect(dialog).toContainText(/everything logged for Maya \([\d,]+ entries\)/);
    await expect(dialog.getByRole("button", { name: "Keep Maya" })).toBeFocused();
    const confirm = dialog.getByRole("button", { name: "Delete Maya" });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "I understand this can’t be undone" }).check();
    await confirm.click();

    await expect(page.getByRole("status").filter({ hasText: "Maya was deleted." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete Leo" })).toBeDisabled();
    await expect(page.getByText("Leo is the only person here. To delete Leo too, delete your account.")).toBeVisible();

    // Maya was the active person; Home falls back to Leo, and she's gone from the switcher after a reload.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "How’s Leo doing?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Switch to Maya" })).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: /^Switch profile/ }).click();
    await expect(page.getByRole("dialog").getByText("Maya")).toHaveCount(0);
  });

  test("Cancel keeps the person", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await page.goto("/more/settings/data");
    await page.getByRole("button", { name: "Delete Leo" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Keep Leo" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete Leo" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Delete Maya" })).toBeEnabled();
  });

  test("deleting the demo account clears it, and a new demo starts fresh", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await page.goto("/more/settings/data");
    await page.getByRole("button", { name: "Delete Maya" }).click();
    await page.getByRole("alertdialog").getByRole("checkbox").check();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete Maya" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Maya was deleted." })).toBeVisible();

    await expect(page.getByText("This is the demo. Deleting clears its sample data from this browser and leaves the demo.")).toBeVisible();
    await page.getByRole("button", { name: "Delete demo data" }).click();
    await page.getByRole("alertdialog", { name: "Delete the demo data?" }).getByRole("button", { name: "Delete demo data" }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);

    await page.getByRole("button", { name: "Continue without saving" }).click();
    // The new demo has the whole story again, Maya included.
    await expect(page.getByRole("button", { name: "Switch to Maya" })).toBeVisible();
  });
});
