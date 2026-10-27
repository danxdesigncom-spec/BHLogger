#!/usr/bin/env node
// WCAG 2.2 contrast checks for every theme, profile color, module color, status tone and chart color
// in design/tokens.json. Text pairs need 4.5:1; selection, focus rings, borders, switch tracks and
// chart marks need 3:1. No dependencies. Exits 1 if anything fails, so it can run in CI.
// Usage (from the project root): node design/scripts/check-contrast.mjs [--all]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(readFileSync(join(here, "..", "tokens.json"), "utf8"));

const lum = (hex) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const checks = [];
const add = (theme, label, fg, bg, min) => checks.push({ theme, label, fg, bg, min, ratio: ratio(fg, bg) });
for (const [th, c] of Object.entries(t.color)) {
  for (const fg of ["foreground", "foreground-2", "muted-foreground"])
    for (const bg of ["background", "card", "secondary", "muted"]) add(th, `${fg} on ${bg}`, c[fg], c[bg], 4.5);
  if (!c.primary.startsWith("var")) add(th, "primary-foreground on primary", c["primary-foreground"], c.primary, 4.5);
  add(th, "destructive on card", c.destructive, c.card, 4.5);
  add(th, "destructive-border vs card", c["destructive-border"], c.card, 3);
  add(th, "input border vs card", c.input, c.card, 3);
  add(th, "switch-off vs card", c["switch-off"], c.card, 3);
  add(th, "toast-foreground on toast", c["toast-foreground"], c.toast, 4.5);
  add(th, "toast-muted on toast", c["toast-muted"], c.toast, 4.5);
  add(th, "toast-foreground on toast-action", c["toast-foreground"], c["toast-action"], 4.5);
  for (const [p, v] of Object.entries(t.profile)) {
    const { accent, tint, ink, on } = v[th];
    add(th, `${p}: on-profile on accent`, on, accent, 4.5);
    add(th, `${p}: ink on tint`, ink, tint, 4.5);
    add(th, `${p}: accent on tint (active tab)`, accent, tint, 4.5);
    add(th, `${p}: ink on card (links)`, ink, c.card, 4.5);
    add(th, `${p}: accent vs background (selection, focus ring)`, accent, c.background, 3);
    add(th, `${p}: accent vs card`, accent, c.card, 3);
  }
  for (const [m, v] of Object.entries(t.module)) {
    const { bg, ink, iconBg } = v[th];
    add(th, `${m}: ink on tile`, ink, bg, 4.5);
    add(th, `${m}: text on tile`, c.foreground, bg, 4.5);
    add(th, `${m}: secondary text on tile`, th === "light" ? c["foreground-2"] : c["muted-foreground"], bg, 4.5);
    add(th, `${m}: ink on icon circle`, ink, iconBg, 3);
  }
  for (const [s, v] of Object.entries(t.status)) add(th, `status ${s}: ink on bg`, v[th].ink, v[th].bg, 4.5);
  const ch = t.chart[th];
  add(th, "chart axis text on card", ch.axis, c.card, 4.5);
  add(th, "chart highlight-ink text on card", ch["highlight-ink"], c.card, 4.5);
  add(th, "chart band-ink text on band", ch["band-ink"], ch.band, 4.5);
  for (const k of ["neutral", "highlight", "marker", "mood", "asleep", "awake", "baseline"]) add(th, `chart ${k} vs card`, ch[k], c.card, 3);
  if (th === "night") add(th, "night-amber-foreground on night-amber", c["night-amber-foreground"], c["night-amber"], 4.5);
}
const fails = checks.filter((c) => c.ratio < c.min);
const showAll = process.argv.includes("--all");
for (const th of Object.keys(t.color)) {
  const rows = checks.filter((c) => c.theme === th);
  const lowest = rows.reduce((a, b) => (b.ratio - b.min < a.ratio - a.min ? b : a));
  console.log(`${th.padEnd(6)} ${rows.length} checks · closest to the limit: ${lowest.label} ${lowest.ratio.toFixed(2)}:1 (needs ${lowest.min}:1)`);
  if (showAll) for (const r of rows) console.log(`   ${r.ratio >= r.min ? "ok  " : "FAIL"} ${r.ratio.toFixed(2).padStart(5)}  ${r.label}  ${r.fg} on ${r.bg}`);
}
if (fails.length) {
  console.error(`\n${fails.length} failing pair(s):`);
  for (const f of fails) console.error(`  FAIL ${f.theme} · ${f.label}: ${f.ratio.toFixed(2)}:1, needs ${f.min}:1 (${f.fg} on ${f.bg})`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} pairs pass.`);
