# Behavior Logger

A mobile-first web app, installable as a PWA. Parents and caregivers of babies, children and people with special needs use it to:

- log bathroom, eating, activities, mood and medications in three taps or fewer
- share one household record across caregivers
- see trends and print reports for doctors

"Behavior Logger" is a working title. The product owner is David Rodriguez.

## Sources of truth

Read these before planning any milestone.

| File | What it holds |
| --- | --- |
| `PRD.md` | Requirements with IDs (ACC, QL, BTH, EAT, ACT, MOOD, MED, TL, DSH, PAT, RPT, SET), acceptance tests AT-01 to AT-14, the data model, the stack and the build order. **It wins every conflict.** |
| `docs/DESIGN.md` | Design system: tokens, components, states, charts, the print report, themes, copy, accessibility, and known differences between mockups and the PRD. |
| `docs/SCREENS.md` | Notes for screens S01 to S29: routes, behavior, states and data. Read a screen's section before building it. |
| `design/screens/*.html` | Mockups with exact sizes, copy and SVG icons. Start at `design/screens/index.html`. |
| `design/screenshots/*.png` | Each screen at 2x, for visual comparison. |
| `design/tokens.json`, `design/theme.css` | Design tokens. `theme.css` plugs into Tailwind v4 and shadcn/ui. |
| `docs/KICKOFF.md` | Milestones M1 to M12, which follow the PRD build order. |

## Status

- **Phase:** M12 in progress on branch `m12-p1-items`. M12a (quick logging) is done; M12b (deeper logging: foods, tube feeding, behavior durations, day mood prompt, PRN follow-up) is next. The approved M12 plan defers RPT-05 (direct PDF) and ACC-02 (Google sign-in) past the pilot.
- **Decisions made:** D1 cloud sync, D2 email + magic link, D3 stack as written, D12 member_profile_access + ship UI; schema decisions A1–A5 confirmed.
- **M1 deliverables:** Next.js 15 + React 19 scaffold, Tailwind v4 + design tokens, Fredoka/Nunito fonts, light/dark/night themes, profile accent, PWA manifest + Serwist service worker, tab-bar shell, Supabase SSR helpers, middleware (auth guard), next-intl v4 (en strings), GitHub Actions CI.
- **M2 deliverables:** Supabase migrations (13 tables + RLS with SECURITY DEFINER helpers), Zod schemas for all 5 entry types plus household/profile/carecard, hand-written Database TS types, seed script (Rodriguez Family — Leo + Maya, 60 days). Lint, typecheck and contrast all pass.
- **M3 deliverables:** Auth (magic-link via Supabase, S21 login screen), onboarding (household create + profile wizard, S22), More tab (S22 caregivers list), invite caregiver (S23 InviteSheet), join from invite (S24 AcceptInviteForm), manage caregiver (S25 role + profile access). Server actions for all flows, Zod validation, RLS enforced via SECURITY DEFINER. Lint, typecheck and unit tests all pass. Fixed @supabase/ssr v0.6.1 type-arity bug.
- **M4 deliverables:** Quick Log shell — HomeClient with profile-switcher pill + secondary avatar, "How's [name] doing?" greeting, 2×2 module tile grid + full-width Medication tile, tile status from useLatestEntry (TanStack Query), LogSheet bottom-sheet (TimeChip, Add-details disclosure, Save/Undo flow), BathroomSheet (Pee/BM/Both + Bristol consistency picker, care-stage wording), UndoToast (6 s, soft-delete via server action), ProfileSwitcherSheet, ReactQueryProvider in layout. `saveEntry` + `undoEntry` server actions with Zod validation and RLS. 32 unit tests, Playwright e2e specs for AT-03 (backdate) and AT-14 (profile switch). Lint, typecheck and tests all pass.
- **M5 deliverables:** Full module log sheets — BathroomSheet expanded (diaper/toilet branching, infant 4-point scale vs Bristol 1-7, color swatches, BTH-06 calm notice + setFlagged), EatingSheet (Meal/Snack/Drink, which meal auto-select, portion plates, foods chips, EAT-06 urgent notice), FeedingSheet (baby: Breast/Bottle/Solids, bottle contents, oz stepper + quick chips, ml storage), ActivitySheet (3×3 activity grid with exact SVGs, enjoyment faces, duration chips), MoodSheet (5-face scale, feelings chips, notable behaviors for child/teen_adult, meltdown intensity sub-group). `setFlagged` added to ModuleFormContext. 28 new unit tests (60 total), Playwright e2e specs for AT-01 (wet diaper 3 taps), AT-06 (age-appropriate scale), AT-07 (pale stool flag). Lint, typecheck and tests all pass.
- **M5 correction + styling pass:** The M4/M5 sheets wrote data that didn't match the M2 Zod schemas. They now write canonical payloads (PRD section 11), and `saveEntry`/`updateEntry` validate per type (`validateEntryData`). Sheets are rebuilt on shared controls (`components/log/controls.tsx`: radio groups with arrow keys, toggle chips, option tiles, face scale, segmented, stepper, notice). Option sets and care-stage wording live in `lib/options.ts`; summaries in `lib/entries/summary.ts`. Eating and Feeding are one sheet driven by `feeding_methods`. Tab bar, sheet, toast, tiles and Home match DESIGN 4.1–4.17. Added the missing `postcss.config.mjs` + `@tailwindcss/postcss` (no Tailwind utilities compiled before) and renamed undefined tokens to the real `theme.css` ones.
- **Data layer:** Every screen reads and writes through `useRepo()` (`lib/data/`). Live mode: Supabase reads, server-action writes, an IndexedDB outbox for entries (`lib/data/outbox.ts`, idempotent upserts, retry with backoff, cached reads offline) and Realtime invalidation. Demo mode: IndexedDB only.
- **Demo mode:** "Continue without saving" on the login screen sets an httpOnly `bl-demo` cookie. Data is generated by `lib/demo/generate.ts` (the same generator as `pnpm db:seed`, anchored to now) into the browser's IndexedDB; the visitor plays Mom (admin). Exit clears it. On in dev, off in production builds unless `NEXT_PUBLIC_ENABLE_DEMO=1`. Inviting and managing caregivers still needs a real session.
- **M6 deliverables:** `/meds` (S06: Overdue/Due/Later/As needed/Given today, "Not logged" never "Missed"), give-dose sheet (S07: saved dose, half dose, outcomes, PRN reasons incl. Constipation), duplicate-dose dialog (S08, Cancel default, override saved as `duplicate_override`), add/edit medication (S09, MED-11 notice, effective-from date writes `medication_changes`), `/meds/[id]` history with 30-day adherence (MED-10). Rules in `lib/meds/schedule.ts` with unit tests for AT-04, AT-05, MED-10. Home banners (QL-08: med not logged/due, BM alert, last fed), dismissals remembered per event.
- **M7 deliverables:** `/timeline` (S10: module filters, day headers with TL-04 summary, rows with For doctor and Waiting to sync badges, caregiver label, day-by-day loading, live updates via Realtime), edit sheet `?entry=<id>` (S11: person, time with no future, the module's own pickers prefilled, note, flag, TL-05 edit history wording, delete with confirm and Undo), `/timeline/deleted` (TL-06 restore). Read-only for other caregivers' entries and viewers (ACC-09). Rules in `lib/timeline.ts` with unit tests.
- **M8 deliverables:** Outbox (see Data layer) plus offline banner with pending count, PWA icons (`node scripts/make-icons.mjs`), service worker that caches the app shell and RSC payloads but never Supabase responses (health data stays out of Cache Storage), `/offline` fallback, install prompt after the third logging session (native prompt on Chrome/Android, Share → Add to Home Screen on iOS Safari). `public/sw.js` is build output and gitignored. AT-08 is covered by unit tests on the merge rule and a Playwright spec that needs `E2E_STORAGE_STATE` (a signed-in session). Installing on real iOS/Android devices is not yet verified.
- **M9 deliverables:** `/insights` Today cards (S12, DSH-01, incl. baby wet/feeds and the pattern promo), `/insights/trends` (S13: 7/30/90/Custom range that persists, module filters, mood line with medication-change markers and before/after averages, time-of-day × weekday heatmap, feelings, BMs/day with 7-day average and "None" band, wet diapers, potty training, consistency, behaviors, feeds and portions, reactions, activities, adherence, dose times, PRN reasons and follow-ups; every chart has a headline, `role="img"` and View as table), `/insights/patterns` (S14: PAT-01/02/03 with sample sizes, "How we calculated this", the DSH-13 line, Keep logging with progress, Add to report stored for M10). Math in `lib/insights/` with unit tests (AT-11, PAT-01–03 on the story data, local time zones). Charts use the theme's `--chart-*` tokens.
- **M10 deliverables:** `/reports` builder (S15: person, 7/30/90/Custom and Since last appointment ranges with resolved dates, appointments list and add (RPT-07), Doctor/Therapist/School/Custom templates that preselect sections, Include switches, items added from Insights (DSH-12), questions for the visit (RPT-08), Preview, Export CSV combined or per module (RPT-04, formula-safe), Share via the share sheet with download fallback (RPT-06)). `/reports/print` (S16/S17, RPT-02/03/09): Letter layout in ink and grays, care notes, medications with "given in period" (MED-10) and changes, summary boxes, mood and bathroom charts with markers and bands, behaviors, eating, activities, flagged events (incl. app BM alert), patterns that met thresholds, questions; sections never split; page numbers and footer via `@page` where supported. AT-13 Playwright spec prints a Letter PDF and checks ≤ 3 pages (Chromium).
- **M11 (settings) deliverables:** More tab rebuilt on the household context so it works in demo and live (S22: people with archive/restore, caregivers with D12 access text, settings rows, sign out that clears this device's offline cache and warns about unsynced entries). `/more/settings/units` (SET-01 volume, 12/24-hour time, week start for the household; SET-05 per-profile BM alert, wet-diaper minimum, dose and duplicate-dose windows), `/more/settings/theme` (SET-02), `/more/settings/data` (SET-06 JSON + CSV export of everything, ACC-13 archive), `/more/profiles/[id]` (details, SET-04 modules and option lists with hide/add/archive used by the sheets, ACC-12 care card). All time formatting goes through `lib/prefs.ts`. Demo edits to household and profiles persist in a `bl-demo-overrides` cookie; the demo story regenerates each new day. Wet-diaper banner (BTH-09) on Home. **Open decision:** permanent deletion (SET-07) needs either a delete RLS policy / SECURITY DEFINER function or a server-only service-role path; the UI explains it isn't switched on yet.
- **M11 (a11y + e2e) deliverables:** `tests/e2e/acceptance.spec.ts` runs AT-01–07, 10, 12 and 14 in demo mode (time-dependent ones pin the clock to the story), `report.spec.ts` AT-13 (Letter PDF ≤ 3 pages, Chromium), `a11y.spec.ts` axe on 11 screens in light and dark with zero critical or serious violations. Passing on Chromium, WebKit and iPhone 14 Pro Safari. Firefox can't launch on this machine (profile error), so it's unverified here. `tests/rls/roles.test.ts` (AT-09) is written but not yet run against the real project. Fixes from the pass: names that contain visible text (WCAG 2.5.3), dose-times chart as plain SVG, three-step heatmap with passing contrast.
- **M11 (strings) deliverables (SET-08):** Every user-facing string lives in `messages/en.json`, including page titles and server-action errors. Components use `useTranslations` / `getTranslations`; non-React code (option labels, summaries, insight headlines, report text, dose units with plurals, med forms) uses `t()` from `lib/i18n.ts` over the same messages. Dates go through `lib/dates.ts` / `lib/prefs.ts` with the household locale, and lists through `Intl.ListFormat`. English output is unchanged except for grammar fixes ("2 tablets", "Wet and dirty diaper", "an admin"). The M3 screens (login, onboarding, invite, manage caregiver) moved from hex and Tailwind palette colors to tokens. Adding a language means adding `messages/<locale>.json` and listing it in `lib/i18n.ts`.
- **M12a deliverables:** Quick taps on Home (QL-09, DESIGN 4.5): up to 6 per profile in the `favorites` table, saved from an entry's edit sheet ("Add to quick taps"), reordered or removed in More → profile; one tap logs now with the Undo toast, and a medication quick tap still runs the MED-07 guard. "Same as last time" chip at the top of the four module sheets (QL-10). Timers for breastfeeding and activities (QL-11, ACT-03): a device-local draft in IndexedDB (`lib/timers.ts`, `bl-timers`), shown on Home for every profile with Stop and Discard; Stop saves one entry with `occurred_at`, `ended_at` and `duration_min`. Home tile order per profile (QL-12) in `settings.tile_order`, set with arrows in More → profile → Modules (admins). The demo story seeds the mockup quick taps. `saveEntry` accepts `endedAt`.
- **Supabase:** Project linked (acxyylzhrazzvbxejsks). `.env.local` required for runtime. Run `pnpm db:seed` to load the Rodriguez Family story (Leo + Maya, 60 days ending Mon, Oct 26, 2026 7:05 PM); it's re-runnable and replaces the seed household's entries.

## Stack

This is the PRD section 12 recommendation; confirm it in the first plan.

- Next.js (App Router) with TypeScript in strict mode
- Tailwind CSS v4 with shadcn/ui (Radix)
- Supabase: Postgres, Auth, row-level security, Realtime
- TanStack Query and Zod
- Offline: Serwist (service worker) and Dexie (IndexedDB outbox)
- Recharts for charts, next-intl for strings
- Testing: Vitest with Testing Library; Playwright on WebKit, Chromium and Firefox, with axe-core
- Hosting: Vercel

Pick one package manager and record it below.

## Commands

Package manager: **pnpm 12**. First install: `pnpm install --allow-build=@parcel/watcher --allow-build=@swc/core --allow-build=esbuild --allow-build=sharp --allow-build=unrs-resolver` (subsequent installs just `pnpm install`).

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server with Turbopack on http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint (next/core-web-vitals + next/typescript) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests (single run) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:e2e` | Playwright (all projects). Most specs run in demo mode with no account; live-only specs skip without `NEXT_PUBLIC_SUPABASE_URL` / `E2E_STORAGE_STATE` |
| `pnpm test:rls` | AT-09 role tests against the real Supabase project and seed users (reads `.env.local`; attempts writes that RLS must reject) |
| `pnpm check-contrast` | WCAG contrast check — exits 1 on failure |
| `pnpm build-theme` | Rebuild `design/theme.css` from `design/tokens.json` |
| `pnpm db:reset` | Supabase DB reset (requires Supabase CLI) |
| `pnpm db:seed` | Run the Leo/Maya seed script |

## Non-negotiables

1. **Tap, don't type.** No required text field outside setup: names of people and medications, doses and custom options. Every core log takes 3 taps or fewer: tile, choice, Save.
2. **Undo on every save.** A toast stays at least 5 s and names the profile. Undo removes the entry on every device.
3. **Medication safety.**
   - The duplicate-dose guard (MED-07) defaults to Cancel and records overrides.
   - The app never calculates or suggests doses (MED-11).
4. **Right person, every time.**
   - The profile's name and color appear on every log screen and toast.
   - Switching profiles changes the accent color (`data-profile-color`).
5. **Offline-first.**
   - Client-generated UUIDs and an IndexedDB outbox make writes idempotent.
   - Edits are last-write-wins, with revision history.
   - Saving never waits on the network.
6. **Security and privacy.**
   - Row-level security on every table, with role checks enforced in the database (ACC-09).
   - The Supabase service-role key never reaches client code.
   - No third-party scripts, ad or tracking SDKs, or analytics that receive health data.
   - Error tracking scrubs entry payloads.
7. **Accessibility: WCAG 2.2 AA.**
   - Primary targets are at least 48 px; color is never the only signal.
   - Visible focus, reduced motion and 200% text.
   - axe stays clean in CI.
8. **Canonical data.** Store volumes in ml, durations in minutes, and timestamps in UTC with each entry's IANA time zone. Convert only for display.
9. **Describe, never diagnose.**
   - Every pattern card shows its sample size and "Patterns aren't proof of cause. Share them with your care team." (DSH-13).
   - Urgent copy says to call 911.
10. **Strings and wording.** Externalize every user-facing string (next-intl). Wording follows the care stage (PRD Appendix A); never use baby words for an adult.

## Design rules

Details are in `docs/DESIGN.md`.

- **Tokens:** import `design/theme.css` from `app/globals.css` and use tokens only, never hex values in components.
  - Primary buttons are ink (`bg-primary`).
  - Selection uses the profile accent (`bg-profile text-on-profile`) plus a check icon.
  - Module colors: `bg-bathroom`, `text-bathroom-ink` and so on.
- **Fonts:** load with `next/font`. Fredoka 500 and 600 as `--font-fredoka`; Nunito 400, 700 and 800 as `--font-nunito`.
- **Themes:** set `data-theme="light|dark|night"` and `data-profile-color` on `<html>`. Dark (SET-02) is P0 and not mocked; build it from the tokens.
- **Icons:** `lucide-react` with `strokeWidth={2}`. Copy the custom SVGs (stool scales, portion plates, mood faces) from the mockups.
- **Conflicts:** when a mockup disagrees with the PRD, follow the PRD. DESIGN.md section 10 lists the known cases, such as 48 px chips and the full option lists.

## Scope

- **Build order:** P0 first, then P1, following docs/KICKOFF.md.
- **Phase 2 and 3 are context only.** That includes S28 (sleep) and S29 (behavior incidents). Keep `entries` type-extensible (QL-14), but don't build their UI.
- **Seed data:** the mockups share one story: Leo (6, violet), Maya (7 months, teal), and Mom, Dad and Grandma, on Mon, Oct 26, 2026. The seed script should recreate it, so screens can be compared with `design/screenshots/`.

## Working agreements

- **Plan first.** Write a plan before coding each milestone. List the ambiguities and wait for David's approval on the schema, RLS, and anything hard to undo.
- **Commits:** small, reviewable commits on a feature branch.
  - Never commit secrets: keep `.env.local` gitignored and `.env.example` current.
- **Each milestone:**
  1. Write tests: unit tests for rules (dose interval, adherence, pattern thresholds, unit conversion), RLS tests, and Playwright tests for the AT scenarios.
  2. Run lint, typecheck and the tests.
  3. Compare the screens you touched with `design/screenshots/` at 390 × 844.
  4. Report progress by requirement ID.
- **Dependencies:** ask before adding any outside the stack above.
- **Docs:** don't edit `PRD.md`, `docs/` or `design/` unless David asks; propose changes instead. Keep this file's Status and Commands sections current.
