import { test, expect } from "@playwright/test";
import { enterDemo, logSheet, STORY, switchTo } from "./helpers";

// M12b: foods and new foods (EAT-08, EAT-09), tube feeding (EAT-10), behavior durations (MOOD-04),
// the day mood prompt (MOOD-06) and the as-needed follow-up (MED-12), in demo mode.
const LEO = "a1000000-0000-0000-0000-000000000008";
const firstRow = (page: import("@playwright/test").Page) => page.getByRole("main").locator("section button").first();

test.describe("Deeper logging (M12b)", () => {
  test("EAT-08 + EAT-09: foods from the personal list, a new food, and a new food flag", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.getByRole("button", { name: /^Eating / }).click();
    const sheet = logSheet(page);
    await sheet.getByRole("radio", { name: "Meal" }).click();
    await sheet.getByRole("button", { name: "Pasta", exact: true }).click();
    await expect(sheet.getByRole("button", { name: "Pasta", exact: true })).toHaveAttribute("aria-pressed", "true");

    await sheet.getByRole("button", { name: "Add food" }).click();
    await sheet.getByRole("textbox", { name: "Food name" }).fill("Broccoli");
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
    await expect(sheet.getByRole("button", { name: "Broccoli", exact: true })).toHaveAttribute("aria-pressed", "true");

    await sheet.getByRole("button", { name: /^Add details/ }).click();
    await sheet.getByRole("switch", { name: /New food/ }).check();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "logged for Leo" })).toBeVisible();

    await page.getByRole("link", { name: "Timeline" }).click();
    await page.getByRole("radiogroup", { name: "Filter by module" }).getByRole("radio", { name: "Eating" }).click();
    await expect(firstRow(page)).toContainText("Pasta, broccoli");
  });

  test("EAT-10: tube feeding is turned on per profile and totals show in Trends", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.goto(`/more/profiles/${LEO}`);
    await page.getByRole("button", { name: "Tube feeding" }).click();
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Details saved" })).toBeVisible();

    await page.getByRole("link", { name: "Log" }).click();
    await page.getByRole("button", { name: /^Eating / }).click();
    const sheet = logSheet(page);
    await sheet.getByRole("radio", { name: "Tube" }).click();
    await sheet.getByRole("button", { name: "Add formula" }).click();
    await sheet.getByRole("textbox", { name: "Formula name" }).fill("Pediasure");
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
    await sheet.getByRole("radiogroup", { name: "Formula amount" }).getByRole("radio", { name: "240 ml" }).click();
    await sheet.getByRole("radiogroup", { name: "Water flush amount" }).getByRole("radio", { name: "30 ml" }).click();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Tube · 240 ml logged for Leo" })).toBeVisible();
    await expect(page).toHaveURL(/localhost:3000\/$/);

    await page.goto("/insights/trends?module=eating");
    await expect(page.getByRole("region", { name: /^Tube feeding: About 240 ml a day by tube/ })).toBeVisible();
  });

  test("MOOD-04: each behavior gets an intensity and a duration", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.getByRole("button", { name: /^Mood / }).click();
    const sheet = logSheet(page);
    await sheet.getByRole("radio", { name: "Upset", exact: true }).click();
    await sheet.getByRole("button", { name: "Meltdown", exact: true }).click();
    await sheet.getByRole("radio", { name: "Severe" }).click();
    await sheet.getByRole("radiogroup", { name: "How long the Meltdown lasted" }).getByRole("radio", { name: "15 min" }).click();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "logged for Leo" })).toBeVisible();

    await page.getByRole("link", { name: "Timeline" }).click();
    await page.getByRole("radiogroup", { name: "Filter by module" }).getByRole("radio", { name: "Mood" }).click();
    await expect(firstRow(page)).toContainText("Severe · 15 min");
  });

  test("MOOD-06: after 6 PM, one face saves today's overall mood", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await page.getByRole("button", { name: /^Show all \d+$/ }).click();
    const prompt = page.getByRole("region", { name: "How was today overall?" });
    await prompt.getByRole("radio", { name: "Good" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Day overall: Good logged for Leo" })).toBeVisible();
    await expect(prompt).toHaveCount(0);
  });

  test("MOOD-06: no prompt before 6 PM", async ({ page }) => {
    await enterDemo(page, { at: new Date(2026, 9, 26, 17, 30) });
    await switchTo(page, "Leo");
    await expect(page.getByRole("button", { name: /^Mood / })).toBeVisible();
    await expect(page.getByRole("region", { name: "How was today overall?" })).toHaveCount(0);
  });

  test("DESIGN 4.3: prompts follow the two-banner limit, most urgent first", async ({ page }) => {
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await expect(page.getByRole("region", { name: /^3 days since Leo/ })).toBeVisible();
    await expect(page.getByRole("region", { name: /^Melatonin at/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "How was today overall?" })).toHaveCount(0);
    await page.getByRole("button", { name: "Show all 4" }).click();
    await expect(page.getByRole("region", { name: "How was today overall?" })).toBeVisible();
  });

  test("MED-12: Home asks whether an as-needed dose helped, and saves the answer", async ({ page }) => {
    // The story has Ibuprofen given by Dad at 6:00 PM; at 7:05 PM it's due for a follow-up.
    await enterDemo(page, { at: STORY });
    await switchTo(page, "Leo");
    await expect(page.getByRole("region", { name: /^Melatonin at/ })).toBeVisible();
    await page.getByRole("button", { name: /^Show all \d+$/ }).click();
    const prompt = page.getByRole("region", { name: "Did Ibuprofen (children's) help?" });
    await expect(prompt).toContainText("Given 6:00 PM for fever");
    await prompt.getByRole("button", { name: "Helped" }).click();
    await expect(prompt).toHaveCount(0);

    await page.goto("/insights/trends?module=medication");
    await expect(page.getByText(/Did it help: .*helped/)).toBeVisible();
  });
});
