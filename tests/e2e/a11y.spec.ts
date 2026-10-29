import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { enterDemo, setNightCookie, STORY } from "./helpers";

// PRD section 9: zero critical axe violations in light and dark, and night mode (DESIGN 8). Serious ones are reported too.
// Pinned to the story's 7:05 PM so the same banners and prompts are scanned on every run. Next.js's
// dev-tools overlay (<nextjs-portal>) isn't part of the app and only exists in dev, so it's excluded.
const PAGES = ["/", "/?log=bathroom", "/?log=mood", "/meds", "/timeline", "/insights", "/insights/trends", "/insights/patterns", "/reports", "/more", "/more/settings/units"];

for (const theme of ["light", "dark", "night"] as const) {
  test.describe(`axe, ${theme} theme`, () => {
    test(`main screens have no critical or serious violations (${theme})`, async ({ page, context, baseURL }) => {
      test.setTimeout(180_000);
      if (theme === "night") await setNightCookie(page, { override: { on: true, until: null } });
      else await context.addCookies([{ name: "bl-theme", value: theme, url: baseURL ?? "http://localhost:3000" }]);
      await enterDemo(page, { at: STORY });
      const failures: string[] = [];
      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(800);
        const results = await new AxeBuilder({ page }).exclude("nextjs-portal").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        for (const v of results.violations.filter((x) => x.impact === "critical" || x.impact === "serious")) {
          failures.push(`${path} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
        }
      }
      // QL-11: a running timer card on Home.
      await page.goto("/?log=activity");
      await page.getByRole("dialog").getByRole("radiogroup", { name: "Activity" }).getByRole("radio").first().click();
      await page.getByRole("dialog").getByRole("button", { name: "Start timer" }).click();
      await expect(page.getByRole("region", { name: "Running timers" })).toBeVisible();
      const timer = await new AxeBuilder({ page }).exclude("nextjs-portal").include('[aria-label="Running timers"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      for (const v of timer.violations.filter((x) => x.impact === "critical" || x.impact === "serious")) {
        failures.push(`running timer [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      }

      // ACC-12: the care card sheet, opened from the profile switcher.
      await page.goto("/timeline");
      await page.getByRole("button", { name: /^Switch profile/ }).click();
      await page.getByRole("button", { name: "Care card: Leo" }).click();
      await expect(page.getByRole("dialog", { name: "Leo's care card" })).toBeVisible();
      await page.waitForTimeout(500);
      const card = await new AxeBuilder({ page }).exclude("nextjs-portal").include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      for (const v of card.violations.filter((x) => x.impact === "critical" || x.impact === "serious")) {
        failures.push(`care card [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  });
}
