# Claude Code kickoff

Open the Behavior Logger folder in Claude Code and paste the prompt below as your first message. This prompt replaces PRD Appendix B.

## Before you start (for David)

1. **Decide D1 to D3 (PRD section 15) and D12 (DESIGN.md section 13).** Claude Code will ask about them in its first plan. The recommendations are:
   - D1: a cloud-synced household from day one
   - D2: email plus Google sign-in at launch
   - D3: the stack as written in PRD section 12
   - D12: add the per-person access table now
2. **Have these ready:**
   - Node 20 or newer, and Git
   - a Supabase project, or Docker for a local Supabase
   - a Vercel account for preview deploys
3. **If you'll use Claude Code on the web,** put this folder in a GitHub repository first. On your computer, you can use the folder as it is. Moving it out of Downloads (for example to `~/Projects/behavior-logger`) keeps it out of the way of cleanups.

## The prompt

```text
You're building Behavior Logger, a mobile-first PWA for caregivers. Everything you need is in this folder:
- CLAUDE.md: project rules and non-negotiables (already loaded).
- PRD.md: requirements with IDs, acceptance tests, data model, stack and build order. It wins every conflict.
- docs/DESIGN.md: design system and component specs.
- docs/SCREENS.md: build notes for screens S01 to S29.
- docs/KICKOFF.md: the milestone plan (M1 to M12).
- design/: tokens.json, theme.css (Tailwind v4 + shadcn/ui), HTML mockups in design/screens, PNG screenshots in design/screenshots.

Step 1. Read PRD.md, docs/DESIGN.md, docs/SCREENS.md and docs/KICKOFF.md in full.
Look at design/screenshots/01-home.png, 02-log-bathroom.png, 07-give-dose.png,
08-dose-warning.png, 10-timeline.png, 14-insights-patterns.png and 16-report-page-1.png.

Step 2. Before writing any code, reply with:
a) the stack and versions you'll use, and how you'll wire design/theme.css and the fonts;
b) the Supabase schema, row-level security policies and Zod entry schemas, including a proposal for D12 (per-person caregiver access);
c) the folder structure and routing (SCREENS.md suggests log sheets as URL state);
d) your design for the offline outbox and sync (client UUIDs, retries, conflict handling);
e) the milestone plan from KICKOFF.md, with anything you'd change;
f) every ambiguity or contradiction you found across the PRD, DESIGN and SCREENS, each with a recommendation.
Then stop and wait for my approval. I still need to confirm decisions D1 to D3 and D12.

Step 3. After approval, build one milestone at a time. For each milestone:
- build it and write the tests: unit tests for rules, RLS tests, Playwright tests for the AT scenarios it covers;
- run lint, typecheck and all tests;
- start the app and compare every screen you touched with design/screenshots at 390 x 844;
- commit, update the Status and Commands sections of CLAUDE.md, and report progress by requirement ID, with anything I need to decide.

Scope: P0 first, then P1. Don't build Phase 2 or 3 items (including S28 sleep and S29 behavior incidents),
but keep the entries table ready for them.
The MVP is done when acceptance tests AT-01 to AT-14 pass in Playwright on WebKit, Chromium and Firefox,
axe finds no critical violations in the light and dark themes, and every P0 requirement is met.
```

## Milestones

These follow the 12-step build order in PRD section 12.

| # | Milestone | Screens | Requirements | Done when |
| --- | --- | --- | --- | --- |
| M1 | Scaffold, tooling and CI. PWA manifest and service worker shell. Tokens, fonts and themes. App shell with the tab bar and profile accent. | S01 shell | Build step 1; SET-02, SET-08 setup | Lint, typecheck, unit and e2e tests run in CI. `theme.css` is wired. The light, dark and night themes switch. `check-contrast.mjs` runs in CI. |
| M2 | Database schema, row-level security, Zod schemas, seed script | — | Step 2; ACC-09, ACC-11, PRD section 11 | RLS tests prove role and household isolation (AT-09 at the database level). The seed recreates the Leo and Maya story with 60 days of data. |
| M3 | Auth, households, profiles, invites, roles | S21 to S25 | Step 3; ACC-01, ACC-04 to ACC-07, ACC-09, ACC-10, D12 (the Viewer role, ACC-08, is P1) | Invite, then join, then land on Quick Log works end to end. Roles are enforced. |
| M4 | Quick Log shell: tiles, sheet, time chip, Save, Undo toast, profile switcher | S01, S18 | Step 4; QL-01 to QL-08 | AT-03 and AT-14 pass. The toast and Undo pattern works (AT-02 is completed in M7). |
| M5 | Bathroom and Diaper, Eating and Feeding, Activity, Mood modules | S02 to S05, S19, S20 | Step 5; P0 items in BTH, EAT, ACT and MOOD | AT-01, AT-06 and AT-07 pass. Sheets fit without scrolling on 375 × 667. |
| M6 | Medications: setup, schedules, giving a dose, duplicate-dose guard, change history | S06 to S09 | Step 6; MED-01 to MED-11 | AT-04 and AT-05 pass. Medication changes are stored for chart markers. |
| M7 | Timeline with edit, delete and live updates | S10, S11 | Step 7; TL-01 to TL-03 | AT-02 passes. A dose given on one phone shows on another within 5 s. |
| M8 | Offline outbox, sync and PWA install | — | Step 8; offline, sync and PWA rows in PRD section 9 | AT-08 passes. The app installs from iOS Safari and Android Chrome and opens offline. |
| M9 | Insights: Today, Trends, Patterns | S12 to S14 | Step 9; DSH-01 to DSH-08, DSH-11, DSH-13, PAT-01 to PAT-03 | AT-10, AT-11 and AT-12 pass. The dashboard renders 90 days in under 1 s. |
| M10 | Reports: print layout and CSV | S15 to S17 | Step 10; RPT-01 to RPT-04 | AT-13 passes. The 30-day report fits in 3 pages or fewer and reads in grayscale. |
| M11 | Settings and alerts, accessibility pass, full Playwright suite | S22 | Step 11; SET-01, SET-02, SET-04 to SET-08, PRD section 9 | AT-01 to AT-14 pass on all three browser engines. axe is clean in light and dark. |
| M12 | P1 items, then a pilot build | S26, S27 and others | Step 12; all P1 items, including SET-03 night mode, QL-09 favorites, QL-11 timers, TL-05 edit history, ACC-12 care card | The P1 list is complete and a pilot build is deployed. |

## Tips for working with Claude Code on this project

- **Ask for a plan at the start of each milestone,** and approve it before any code is written.
- **When a screen looks off,** point Claude Code at the matching mockup, for example `design/screens/07-give-dose.html`. The exact CSS values are in the mockup source.
- **Start a fresh conversation for each milestone.** CLAUDE.md and the docs carry the context, so a new session stays focused.
- **Keep the Status section in CLAUDE.md current,** so any session can see what's done.
