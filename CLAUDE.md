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

- **Phase:** M4 complete. M5 (full module log sheets: Eating, Mood, Activity, Medication + duplicate-dose guard) is next.
- **Decisions made:** D1 cloud sync, D2 email + magic link, D3 stack as written, D12 member_profile_access + ship UI; schema decisions A1–A5 confirmed.
- **M1 deliverables:** Next.js 15 + React 19 scaffold, Tailwind v4 + design tokens, Fredoka/Nunito fonts, light/dark/night themes, profile accent, PWA manifest + Serwist service worker, tab-bar shell, Supabase SSR helpers, middleware (auth guard), next-intl v4 (en strings), GitHub Actions CI.
- **M2 deliverables:** Supabase migrations (13 tables + RLS with SECURITY DEFINER helpers), Zod schemas for all 5 entry types plus household/profile/carecard, hand-written Database TS types, seed script (Rodriguez Family — Leo + Maya, 60 days). Lint, typecheck and contrast all pass.
- **M3 deliverables:** Auth (magic-link via Supabase, S21 login screen), onboarding (household create + profile wizard, S22), More tab (S22 caregivers list), invite caregiver (S23 InviteSheet), join from invite (S24 AcceptInviteForm), manage caregiver (S25 role + profile access). Server actions for all flows, Zod validation, RLS enforced via SECURITY DEFINER. Lint, typecheck and unit tests all pass. Fixed @supabase/ssr v0.6.1 type-arity bug.
- **M4 deliverables:** Quick Log shell — HomeClient with profile-switcher pill + secondary avatar, "How's [name] doing?" greeting, 2×2 module tile grid + full-width Medication tile, tile status from useLatestEntry (TanStack Query), LogSheet bottom-sheet (TimeChip, Add-details disclosure, Save/Undo flow), BathroomSheet (Pee/BM/Both + Bristol consistency picker, care-stage wording), UndoToast (6 s, soft-delete via server action), ProfileSwitcherSheet, ReactQueryProvider in layout. `saveEntry` + `undoEntry` server actions with Zod validation and RLS. 32 unit tests, Playwright e2e specs for AT-03 (backdate) and AT-14 (profile switch). Lint, typecheck and tests all pass.
- **Supabase:** Project linked (acxyylzhrazzvbxejsks). `.env.local` required for runtime. Run `pnpm db:seed` to load the Rodriguez Family seed (Leo + Maya, 1 729 entries).

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
| `pnpm test:e2e` | Playwright (all projects) |
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
