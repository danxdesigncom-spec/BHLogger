import { test, expect } from "@playwright/test";
import { enterDemo, STORY, switchTo } from "./helpers";

// M12c: food insights (DSH-09), Add to report on charts and patterns (DSH-12), PAT-04 to PAT-07,
// care card fields in the report (RPT-09) and the care card view (ACC-12), in demo mode at story time.
const doc = (page: import("@playwright/test").Page) => page.getByRole("article");

test.describe("Insights and reports (M12c)", () => {
  test("DSH-09: most accepted and refused foods, and new-food markers", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Maya");
    await page.goto("/insights/trends?module=eating");
    const foods = page.getByRole("region", { name: /^Foods: Eats oatmeal best; refused puree most/ });
    await expect(foods).toBeVisible();
    await foods.getByRole("button", { name: "View as table" }).click();
    await expect(foods.getByRole("row", { name: /Oatmeal/ })).toBeVisible();

    const intros = page.getByRole("region", { name: /^New foods: 3 new foods in 30 days/ });
    await expect(intros).toBeVisible();
    await intros.getByRole("button", { name: "View as table" }).click();
    await expect(intros.getByRole("row")).toHaveCount(4);
  });

  test("DSH-12: a chart added from Trends prints for the report's dates, for that person only", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.goto("/insights/trends?module=mood");
    const add = page.getByRole("button", { name: "Add to report: Feelings" });
    await add.click();
    await expect(page.getByRole("button", { name: "In report: Feelings" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("link", { name: "Reports" }).click();
    const added = page.getByRole("region", { name: "Added from Insights" });
    await expect(added).toContainText("Feelings chart");
    await page.getByRole("link", { name: "Preview PDF" }).click();
    await expect(doc(page).getByRole("heading", { name: "Feelings", level: 2 })).toBeVisible();
    await expect(doc(page).getByRole("img", { name: /came up most/ })).toBeVisible();

    await page.goBack();
    await page.getByRole("radiogroup", { name: "For" }).getByRole("radio", { name: "Maya" }).click();
    await expect(page.getByText("Feelings chart")).toHaveCount(0);
  });

  test("DSH-12: an added pattern prints even with the Patterns section off", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.goto("/insights/patterns");
    await page.getByRole("button", { name: "Add to report: Time of day" }).click();

    await page.getByRole("link", { name: "Reports" }).click();
    await page.getByRole("checkbox", { name: "Patterns" }).uncheck();
    await page.getByRole("link", { name: "Preview PDF" }).click();
    const patterns = doc(page).getByRole("heading", { name: "Patterns the app noticed" });
    await expect(patterns).toBeVisible();
    await expect(doc(page)).toContainText("4–7 PM is usually the hardest time");
    await expect(doc(page)).not.toContainText("after the melatonin change");
  });

  test("PAT-04 to PAT-07: each rule shows a pattern, no clear difference, or Keep logging", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.goto("/insights/patterns");
    await expect(page.getByRole("region", { name: "Activities and mood" })).toContainText("No activity stood out");
    await expect(page.getByRole("region", { name: "Day of the week" })).toContainText("about the same on every day");
    await expect(page.getByRole("region", { name: "Eating and mood: keep logging" })).toBeVisible();
    const prn = page.getByRole("region", { name: "When Ibuprofen (children's) is given: keep logging" });
    await expect(prn).toContainText("2 of 5");

    await page.getByRole("button", { name: /^Switch profile/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Maya/ }).click();
    const weekday = page.getByRole("region", { name: /^Day of the week: .+ is usually the hardest day/ });
    await expect(weekday).toBeVisible();
    await expect(weekday).toContainText("Patterns aren't proof of cause. Share them with your care team.");
    await expect(weekday).toContainText("days with mood logs");
  });

  test("RPT-09: the caregiver chooses which care card fields print", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.getByRole("link", { name: "Reports" }).click();
    const fields = page.getByRole("region", { name: "Care card in the report" });
    await expect(fields.getByRole("switch", { name: "Emergency contacts" })).not.toBeChecked();
    await fields.getByRole("switch", { name: "Emergency contacts" }).check();
    await fields.getByRole("switch", { name: "Allergies" }).uncheck();

    await page.getByRole("link", { name: "Preview PDF" }).click();
    await expect(doc(page).getByRole("heading", { name: "Allergies and care notes" })).toBeVisible();
    await expect(doc(page)).toContainText("Mom (Parent), 312-555-0101");
    await expect(doc(page)).not.toContainText("Peanuts");

    // Remembered per profile on this device.
    await page.goBack();
    await expect(page.getByRole("region", { name: "Care card in the report" }).getByRole("switch", { name: "Emergency contacts" })).toBeChecked();
  });

  test("ACC-12: the care card is 2 taps from a tab screen, with tap-to-call", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await page.getByRole("link", { name: "Timeline" }).click();
    // Wait for Timeline; Home has its own Switch profile pill until the navigation finishes.
    await expect(page.getByRole("heading", { name: "Timeline", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: /^Switch profile/ }).click();
    await page.getByRole("button", { name: "Care card: Leo" }).click();
    const sheet = page.getByRole("dialog", { name: "Leo's care card" });
    await expect(sheet.getByRole("heading", { name: "Leo's care card" })).toBeFocused();
    await expect(sheet).toContainText("Peanuts");
    await expect(sheet).toContainText("Mild asthma");
    await expect(sheet.getByRole("link", { name: "Call Mom" })).toHaveAttribute("href", "tel:3125550101");
    await expect(sheet.getByRole("link", { name: "Call Dr. Chen" })).toHaveAttribute("href", "tel:3125550100");

    await sheet.getByRole("button", { name: "Back to profiles" }).click();
    await expect(page.getByRole("dialog", { name: "Switch profile" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Care card: Leo" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Switch profile/ })).toBeFocused();
  });
});
