import { test, expect } from "@playwright/test";
import { enterDemo, STORY } from "./helpers";

// AT-13: a 30-day Doctor visit report includes the header, medications, summaries, charts with
// markers and flagged events, and prints on Letter in 3 pages or fewer.
test.describe("Doctor report (AT-13)", () => {
  test("prints a 30-day Doctor visit report on Letter in 3 pages or fewer", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "PDF printing is Chromium-only in Playwright");
    // At the story's moment the report has the mockup's patterns and flagged events, whatever the real time.
    await enterDemo(page, { at: STORY });
    await page.goto("/reports");
    await page.getByRole("radio", { name: "30 days" }).click();
    await page.getByRole("radio", { name: "Doctor visit" }).click();
    await page.getByRole("link", { name: "Preview PDF" }).click();

    const doc = page.getByRole("article");
    await expect(doc.getByRole("heading", { name: "Current medications" })).toBeVisible({ timeout: 20_000 });
    for (const heading of ["Allergies", "30-day summary", "Flagged for the doctor", "Patterns the app noticed"]) {
      await expect(doc.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(doc.getByRole("heading", { name: /^Mood,/ })).toBeVisible();
    await expect(doc.getByRole("heading", { name: /^Bathroom,/ })).toBeVisible();
    await expect(doc.locator(".recharts-reference-line").first()).toBeAttached();
    await expect(doc).toContainText("Not a medical record or diagnosis");

    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true, printBackground: true });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThan(0);
    expect(pages).toBeLessThanOrEqual(3);
  });
});
