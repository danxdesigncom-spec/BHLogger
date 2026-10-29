import { test, expect } from "@playwright/test";
import { enterDemo, STORY, switchTo } from "./helpers";

// AT-11 (DSH-13, PAT-01): below the minimum data, Patterns shows progress instead of a pattern.
const LEO = "a1000000-0000-0000-0000-000000000008";

test("AT-11: with 10 days of mood data, Keep logging shows progress toward 14 days and PAT-01 stays hidden", async ({ page }) => {
  await enterDemo(page, { at: STORY });
  await switchTo(page, "Leo");
  // The story's data is in place once the tiles show it (the demo writes it to IndexedDB on first load).
  await expect(page.getByRole("button", { name: /^Mood\s+Upset · 5:30 PM/ })).toBeVisible();

  // The demo story has 60 days. Leave Leo only the last 10 days of mood logs (Oct 17 to 26) in this browser's demo data.
  const days = await page.evaluate(async ({ leo, from }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("bl-demo");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction("entries", "readwrite");
    const kept = new Set<string>();
    const cursor = tx.objectStore("entries").openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c) return;
      const e = c.value as { profile_id: string; type: string; occurred_at: string };
      if (e.profile_id === leo && e.type === "mood") {
        if (e.occurred_at < from) c.delete();
        else kept.add(new Date(e.occurred_at).toDateString());
      }
      c.continue();
    };
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return kept.size;
  }, { leo: LEO, from: new Date(2026, 9, 17).toISOString() });
  expect(days).toBe(10);

  await page.goto("/insights/patterns");
  const keep = page.getByRole("region", { name: "Time of day: keep logging" });
  await expect(keep).toBeVisible();
  await expect(keep).toContainText("Patterns appear after 14 days of mood logs · 10 of 14");
  await expect(keep.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
  await expect(keep.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "14");
  await expect(page.getByText(/is usually the hardest part of the day/)).toHaveCount(0);
});
