#!/usr/bin/env node
// Regenerates design/theme.css from design/tokens.json. No dependencies.
// Usage (from the project root): node design/scripts/build-theme.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const designDir = join(here, "..");
const t = JSON.parse(readFileSync(join(designDir, "tokens.json"), "utf8"));
const THEMES = Object.keys(t.color); // light, dark, night

const HEADER = `/*
  Behavior Logger · "Little Wins" design tokens for Tailwind CSS v4 + shadcn/ui
  Generated from design/tokens.json. Do not edit by hand: change tokens.json, then run
    node design/scripts/build-theme.mjs     (rewrites this file)
    node design/scripts/check-contrast.mjs  (WCAG checks; exits 1 on failure)

  Use in app/globals.css:
    @import "tailwindcss";
    @import "../design/theme.css";      (or copy this file into src/styles)

  Runtime switches (set on <html>):
    data-theme="light" | "dark" | "night"       light is the default; dark = SET-02 (P0); night = SET-03 (P1)
  Set on <html> or the app shell, from the active profile (QL-07):
    data-profile-color="violet" | "teal" | "rose" | "amber" | "blue"

  Fonts: load with next/font and expose --font-fredoka and --font-nunito (see docs/DESIGN.md, section 2.6).
*/

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
@custom-variant night (&:where([data-theme="night"], [data-theme="night"] *));
`;
const DEFAULT_ACCENT = `
/* Default accent before a profile exists (sign-up, onboarding). Profile blocks above redeclare the
   derived variables, so data-profile-color works on <html> or on any wrapper. */
:root:not([data-profile-color]) { --profile: #5B3BE6; --profile-tint: #E8E4FC; --profile-ink: #3B21B8; --profile-on: #FFFFFF; }
[data-theme="dark"]:not([data-profile-color]) { --profile: #A898E8; --profile-tint: #2C2547; --profile-ink: #C9BEF5; --profile-on: #14111C; }
[data-theme="night"]:not([data-profile-color]) { --profile: #A898E8; --profile-tint: #2A2238; --profile-ink: #C9BEF5; --profile-on: #15110E; }
`;
const BASE = `
/* Base: body copy, display headings, focus ring and reduced motion */
@layer base {
  html { -webkit-text-size-adjust: 100%; }
  body { background: var(--background); color: var(--foreground); font-family: var(--font-sans); }
  h1, h2, h3 { font-family: var(--font-display); font-weight: 600; }
  :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  }
}
`;

const block = (sel, vals, extra = "") => {
  const out = [`${sel} {`];
  for (const [k, v] of Object.entries(vals)) out.push(`  --${k}: ${v};`);
  if (extra) out.push(extra);
  out.push("}");
  return out.join("\n");
};

const L = [HEADER];
for (const th of THEMES) {
  const sel = th === "light" ? `:root,\n[data-theme="light"]` : `[data-theme="${th}"]`;
  const vals = { ...t.color[th] };
  vals["accent"] = "var(--profile-tint)";
  vals["accent-foreground"] = "var(--profile-ink)";
  vals["ring"] = "var(--profile)";
  for (const [m, v] of Object.entries(t.module)) {
    vals[`module-${m}`] = v[th].bg; vals[`module-${m}-ink`] = v[th].ink; vals[`module-${m}-icon`] = v[th].iconBg;
  }
  for (const [s, v] of Object.entries(t.status)) {
    vals[`status-${s}`] = v[th].bg; vals[`status-${s}-ink`] = v[th].ink; vals[`status-${s}-border`] = v[th].border;
  }
  for (const [k, v] of Object.entries(t.chart[th])) vals[`chart-${k}`] = v;
  vals["chart-1"] = t.module.bathroom[th].ink;
  vals["chart-2"] = t.chart[th].mood;
  vals["chart-3"] = t.module.medication[th].ink;
  vals["chart-4"] = t.module.activity[th].ink;
  vals["chart-5"] = t.module.eating[th].ink;
  if (th === "light") {
    for (const [k, v] of Object.entries(t.stool)) vals[`stool-${k}`] = v;
    vals["radius"] = "1rem";
    for (const [k, v] of Object.entries(t.motion)) vals[k] = v;
  }
  const scheme = th === "light" ? "light" : "dark";
  L.push(`/* ---------- ${th} theme ---------- */\n` + block(sel, vals, `  color-scheme: ${scheme};`) + "\n");
}
L.push("/* ---------- profile accents (QL-07: switching profile changes the accent) ---------- */");
for (const [p, v] of Object.entries(t.profile)) {
  for (const th of THEMES) {
    const { accent, tint, ink, on } = v[th];
    const sel = th === "light"
      ? `[data-profile-color="${p}"]`
      : `[data-theme="${th}"][data-profile-color="${p}"],\n[data-theme="${th}"] [data-profile-color="${p}"]`;
    const vals = { "profile": accent, "profile-tint": tint, "profile-ink": ink, "profile-on": on,
      "accent": "var(--profile-tint)", "accent-foreground": "var(--profile-ink)", "ring": "var(--profile)" };
    if (th === "night") Object.assign(vals, { "primary": "var(--profile)", "primary-foreground": "var(--profile-on)" });
    L.push(block(sel, vals));
  }
}
L.push(DEFAULT_ACCENT);

const ti = ["@theme inline {"];
const names = ["background","foreground","card","card-foreground","popover","popover-foreground","primary","primary-foreground",
  "secondary","secondary-foreground","muted","muted-foreground","accent","accent-foreground","destructive","border","input","ring",
  "foreground-2","destructive-border","divider","border-strong","dashed-line","grabber","switch-off","toast","toast-foreground",
  "toast-muted","toast-action","chart-1","chart-2","chart-3","chart-4","chart-5"];
for (const n of names) ti.push(`  --color-${n}: var(--${n});`);
for (const n of ["profile","profile-tint","profile-ink"]) ti.push(`  --color-${n}: var(--${n});`);
ti.push("  --color-on-profile: var(--profile-on);");
for (const m of Object.keys(t.module)) ti.push(`  --color-${m}: var(--module-${m});`, `  --color-${m}-ink: var(--module-${m}-ink);`, `  --color-${m}-icon: var(--module-${m}-icon);`);
for (const s of Object.keys(t.status)) ti.push(`  --color-${s}: var(--status-${s});`, `  --color-${s}-ink: var(--status-${s}-ink);`, `  --color-${s}-border: var(--status-${s}-border);`);
for (const k of Object.keys(t.stool)) ti.push(`  --color-stool-${k}: var(--stool-${k});`);
ti.push("  --color-night-amber: var(--night-amber, #F2B66B);");
ti.push('  --font-display: var(--font-fredoka), "Fredoka", "Nunito", system-ui, sans-serif;');
ti.push('  --font-sans: var(--font-nunito), "Nunito", system-ui, -apple-system, "Segoe UI", sans-serif;');
for (const [n, v] of Object.entries(t.type)) ti.push(`  --text-${n}: ${v.size};`, `  --text-${n}--line-height: ${v.lineHeight};`, `  --text-${n}--font-weight: ${v.weight};`);
ti.push("  --radius-sm: calc(var(--radius) - 4px);", "  --radius-md: calc(var(--radius) - 2px);", "  --radius-lg: var(--radius);", "  --radius-xl: calc(var(--radius) + 4px);");
for (const k of ["card","tile","sheet"]) ti.push(`  --radius-${k}: ${t.radius[k]};`);
for (const [k, v] of Object.entries(t.shadow)) ti.push(`  --shadow-${k}: ${v};`);
const rem = (px) => `${parseFloat(px) / 16}rem`;
for (const k of ["gutter","touch","touch-min","button","tabbar","tabbar-clearance"]) ti.push(`  --spacing-${k}: ${rem(t.space[k])};`);
ti.push(`  --ease-sheet: ${t.motion["ease-sheet"]};`, `  --ease-standard: ${t.motion["ease-standard"]};`, "}");
L.push(ti.join("\n"));
L.push(BASE);
writeFileSync(join(designDir, "theme.css"), L.join("\n"));
console.log("Wrote design/theme.css from design/tokens.json");
