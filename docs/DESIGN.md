# Behavior Logger: design handoff spec

Version 1.0 · Oct 27, 2026 · Design direction: "Little Wins" (option B, chosen by David)

This file explains how the app looks and behaves. Read it alongside `PRD.md`, which explains what to build and why. When sources disagree, follow them in this order:

1. `PRD.md`
2. This file
3. The mockups in `design/screens/`

Section 10 lists every known difference between the mockups and the PRD.

## 0. Files in the handoff

| Path | What it is | Use it for |
| --- | --- | --- |
| `design/tokens.json` | Every design token: colors for the light, dark and night themes, profile and module colors, type, radius, shadow, spacing and motion. | The single source of truth. Import it in TypeScript where you need values, for example the profile palette or chart colors. |
| `design/theme.css` | CSS variables and a Tailwind v4 `@theme` block generated from `tokens.json`. It follows shadcn/ui variable names and compiles with Tailwind 4.3. | Import it from `app/globals.css`. Don't edit it by hand. |
| `design/scripts/build-theme.mjs` | Regenerates `theme.css` from `tokens.json`. Node only, no dependencies. | Run it after any token change. |
| `design/scripts/check-contrast.mjs` | WCAG contrast checks for every theme, profile, module, status and chart pair. Exits 1 on failure. | Run it in CI and after any token change. |
| `design/screens/*.html` | 29 mockups as plain HTML with inline styles, linked to each other like the app. Start at `index.html`. | Exact sizes, spacing and copy, plus SVG icons you can lift. |
| `design/screens/manifest.json` | Screen ID, title, phase, PRD requirement IDs and file paths for each screen. | Mapping screens to routes and requirements. |
| `design/screenshots/*.png` | Each screen rendered at 2x with the real fonts. | Visual comparison: look at them, or diff against Playwright screenshots. |
| `docs/SCREENS.md` | Build notes for each screen, S01 to S29. | Behavior, states, data and gaps for each screen. |

**Sample data used in every mockup.** The household is Mom (admin), Dad and Grandma (caregivers).

- **Leo:** 6, child, uses the toilet, violet.
- **Maya:** 7 months, baby, teal.
- **Timing:** day screens are set on Mon, Oct 26, 2026 at about 7:05 PM. Night screens are at 3:05 AM that night. The report covers Sep 27 to Oct 26.
- **Medication:** melatonin started Oct 12.

Build the seed script (PRD section 12, step 2) around the same story, so screens can be compared with the mockups side by side.

## 1. Principles as they show up in the UI

1. **Tap, don't type.** Every log input is a chip, tile, face, stepper or switch. Text fields appear only in setup (names, medication names, doses) and in optional notes.
2. **Who is always visible.** The active profile's color is the app's accent color (QL-07). Every sheet says "for Leo" with a color dot, and every toast names the profile.
3. **Ink for actions, color for identity.** Primary buttons (Save, Give, Continue) are ink (`--primary`) so they look the same for every profile. Selection uses the profile accent plus a check icon. Module pastels show what kind of entry something is.
4. **Calm, not alarming.** Things worth a call to the doctor use amber notices. Red is only for destructive actions, never for health data.
5. **Thumb zone.** Every sheet has a sticky 52 px Save at the bottom, and the tab bar floats at the bottom.
6. **Never color alone.** Selected chips get a check icon and `aria-checked` or `aria-pressed`. Stool swatches have text labels. Charts have direct labels and a table view.
7. **No emoji and no stock art.** Use line icons, plus a few custom drawings: the stool scales, portion plates and mood faces.

## 2. Foundations

All values below exist as CSS variables in `design/theme.css` and as Tailwind utilities. For example, `--profile` becomes `bg-profile`, `--module-bathroom-ink` becomes `text-bathroom-ink`, and `--radius-card` becomes `rounded-card`.

### 2.1 Color: light theme (default)

| Variable | Hex | Use |
| --- | --- | --- |
| `--background` | `#F5F1FC` | App background (lavender ground) |
| `--card`, `--popover` | `#FFFFFF` | Cards, sheets, dialogs |
| `--foreground` | `#1F1A2E` | Primary text and icons (ink) |
| `--foreground-2` | `#3D3654` | Strong secondary text: times, table cells, tile sub-lines |
| `--muted-foreground` | `#5B5470` | Labels, captions, helper text |
| `--primary` / `--primary-foreground` | `#1F1A2E` / `#FFFFFF` | Primary buttons (Save, Give, Continue) |
| `--secondary` | `#F5F1FC` | Unselected chips, close buttons, quiet surfaces inside cards |
| `--muted` | `#EEE9F7` | Neutral avatars, skeletons, tracks |
| `--border` | `#E2DBF0` | Chip and tile borders |
| `--divider` | `#EEE9F7` | Row separators, sheet footer rule |
| `--border-strong` | `#CFC6E3` | Outlined buttons, time chip |
| `--input` | `#8E85AD` | Text-field borders (darker than the mockups, for WCAG 1.4.11) |
| `--dashed-line` | `#9C93B5` | Dashed "More" and "Add" chips |
| `--grabber` | `#D9D2EA` | Sheet grabber |
| `--switch-off` | `#8E85AD` | Switch track when off |
| `--destructive` / `--destructive-border` | `#B42318` / `#D9675C` | Delete and remove actions (outlined) |
| `--overlay` / `--overlay-strong` | `rgba(31,26,46,.42)` / `.55` | Behind sheets / behind alert dialogs |
| `--toast`, `--toast-foreground`, `--toast-muted`, `--toast-action` | `#1F1A2E`, `#FFFFFF`, `#D9D2EA`, `#3A3350` | Save toast with Undo |

### 2.2 Profile colors (QL-07)

Each profile picks one of five colors when it's created (S21). The active profile's color drives `--profile`, which colors these things:

- avatars and the profile switcher
- selected chips, tiles and segments (accent fill, white text, check icon)
- the active tab (tint background, accent text)
- the focus ring
- links (ink)
- the toast check
- the "for Leo" dot

Set `data-profile-color` on `<html>`, together with `data-theme`, whenever the profile changes.

| Name | Light accent / tint / ink | Dark accent / tint | Night accent / tint |
| --- | --- | --- | --- |
| violet (Leo) | `#5B3BE6` / `#E8E4FC` / `#3B21B8` | `#A898E8` / `#2C2547` | `#A898E8` / `#2A2238` |
| teal (Maya) | `#0F766E` / `#DDECEB` / `#0B5A54` | `#5FC9BA` / `#173532` | `#7FD1C3` / `#1D3330` |
| rose | `#B4235F` / `#FBE3EC` / `#8A1748` | `#F29BBE` / `#3A1D2A` | `#E6A0BA` / `#33202A` |
| amber | `#9A4A00` / `#FCEBD7` / `#6E3500` | `#F2B66B` / `#3A2A14` | `#F2B66B` / `#33261A` |
| blue | `#1D4F91` / `#E1ECFA` / `#163E73` | `#8DB8F2` / `#1B2A44` | `#9CC3F0` / `#1E2A3A` |

Text on the accent (`--profile-on`) is white in the light theme. In the dark and night themes it's the dark background color. Every pairing passes WCAG AA (section 12).

### 2.3 Module colors

Pastel tile backgrounds with a darker "ink" color for icons and labels. They're used on Home tiles, icon circles, timeline icons, Today cards and chart series.

| Module | Light bg / ink | Dark bg / ink | Night bg / ink / icon circle | Icon (Lucide) |
| --- | --- | --- | --- | --- |
| Bathroom / Diaper | `#DCEBFF` / `#1D4F91` | `#172338` / `#9CC3F0` | `#1C2633` / `#9CC3F0` / `#26344A` | `droplet` |
| Eating / Feeding | `#FFE3D3` / `#9A3412` | `#2E1D16` / `#F4B48E` | `#2E1F18` / `#F4B48E` / `#3D2A20` | fork and knife (custom, S03); bottle for feeding (S19) |
| Mood | `#FFF0B5` / `#7A5A00` | `#2B2612` / `#F2D27A` | `#2B2414` / `#F2D27A` / `#3A3019` | `smile` |
| Activity | `#D5F3E2` / `#166534` | `#142A1E` / `#8FD9AE` | `#1A2A20` / `#8FD9AE` / `#22382B` | `star` |
| Medication | `#E9DFFF` / `#5B21B6` | `#241B36` / `#CDB4FF` | `#2A2036` / `#CDB4FF` / `#372A48` | `pill` |
| Sleep (Phase 2) | `#E0E7FF` / `#3730A3` | `#1C1D38` / `#B9B5FF` | `#222137` / `#B9B5FF` / `#2E2C4D` | `moon` |
| Behavior (Phase 2) | `#FFE0E6` / `#9F1239` | `#2E1620` / `#F4A3B5` | `#2E1A20` / `#F4A3B5` / `#3F2329` | `zap` |

### 2.4 Status colors

| Tone | Light bg / ink / border | Used for |
| --- | --- | --- |
| warning | `#FFF1D6` / `#7A4100` / `#F2CF8C` | "Worth mentioning to your doctor" notices (BTH-06), "3 days since BM" pills, dose-check icon, last-given hints |
| info | `#E6F0FF` / `#1D3F73` / `#BFD5F5` | Neutral guidance ("Enter the dose your doctor or pharmacist gave you"), offline banner |
| success | `#DCF5E6` / `#14532D` / `#A8DDBE` | "Given 8:02 AM · Dad" chips |
| flag | `#FFE4EA` / `#9F1239` / `#F5B8C6` | "For doctor" badge, urgent copy ("If this is happening now, call 911") |

Dark and night versions of each tone are in `tokens.json` and `theme.css`.

### 2.5 Stool swatches and chart colors

- **Stool colors (BTH-05).** These are the same in every theme. Each swatch always has a text label.
  - Yellow `#E3B53B`
  - Green `#5E7F2A`
  - Brown `#7B4B2A`
  - Black `#2A2522`
  - Red `#B42318`
  - Pale `#EDE7D9`, with a `#B9AE95` border
  - Other: a dashed circle with a plus
- **Charts (light).**
  - Grid `#EEE9F7`; axis text `#5B5470`; baseline `#1F1A2E`.
  - Neutral bars `#8E85AD`; highlight `#B45309`, with labels in `#9A4700`.
  - Mood line `#B45309`; medication-change marker `#5B21B6`, dashed.
  - Threshold band `#FFF1D6`, with its label in `#7A4100`.
  - Other series use the module inks.
  - Phase 2 sleep: asleep `#4F46E5`, awake `#D97706`.
  - The shadcn `--chart-1` to `--chart-5` variables map to bathroom, mood, medication, activity and eating.

### 2.6 Typography

**Fonts:** Fredoka (600, plus 500 as a fallback weight) for headings and big numbers, and Nunito (400, 700, 800) for everything else. Load both with `next/font` so they're self-hosted:

```ts
// app/layout.tsx
import { Fredoka, Nunito } from "next/font/google";
const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fredoka", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "700", "800"], variable: "--font-nunito", display: "swap" });
// <html lang="en" data-theme="light" data-profile-color="violet" className={`${fredoka.variable} ${nunito.variable}`}>
```

`font-display` maps to Fredoka and `font-sans` to Nunito. Each `text-*` utility below sets the size, line height and default weight; add `font-display` for the Fredoka styles.

| Token (`text-…`) | Size / line height | Weight · family | Use |
| --- | --- | --- | --- |
| `display-1` | 32 / 1.1 | 600 · Fredoka | Home greeting, stepper values, hero numbers |
| `display-2` | 30 / 1.1 | 600 · Fredoka | Tab page titles (Timeline, Insights, More), Today card values |
| `title-1` | 26 / 1.1 | 600 · Fredoka | Sheet titles; use 28 for onboarding and invite heroes |
| `title-2` | 24 / 1.2 | 600 · Fredoka | Alert dialog headlines |
| `title-3` | 21 / 1.15 | 600 · Fredoka | Home tile labels |
| `title-4` | 19 / 1.25 | 600 · Fredoka | Day headers, chart and pattern headlines |
| `title-5` | 18 / 1.2 | 600 · Fredoka | List group titles on More |
| `body-lg` | 17 / 1.3 | 800 · Nunito | Primary buttons, large choice buttons |
| `body-md` | 16 / 1.35 | 800 · Nunito | List row titles, banner titles |
| `body` | 15 / 1.35 | 700 · Nunito | Chips (800 when selected), row titles, body copy |
| `label` | 14 / 1.3 | 800 · Nunito | Field-group labels in `--muted-foreground` |
| `caption` | 13 / 1.4 | 400 to 700 · Nunito | Secondary lines, helper text |
| `micro` | 12 / 1.3 | 700 to 800 · Nunito | Badges, chart labels, tab labels. Nothing is smaller than 12 px. |

**Rules:**

- Use rem units so text scales to 200% (PRD section 9).
- Use sentence case everywhere.
- Use `tabular-nums` for times in the timeline and for numbers in report tables.
- Text inputs are 16 px, so iOS doesn't zoom on focus.

### 2.7 Spacing, radius, elevation and sizes

| Kind | Value | Where |
| --- | --- | --- |
| Screen gutter | 20 px (`px-gutter`) | Left and right padding on every screen and sheet |
| Card padding | 16 px (14 px in list rows) | Cards, tiles, banners |
| Stack gaps | 8 inside a group · 14 to 16 between groups in sheets · 18 to 22 between page sections | |
| Bottom clearance | 104 px (`pb-tabbar-clearance`), plus the safe area | Scrolling content on tab screens, so the last item clears the floating tab bar |
| Radius | pill `rounded-full` · 12 small (`rounded-sm`) · 16 base (`rounded-lg`) · 18 option tiles (`rounded-[18px]`) · 20 row groups, toast (`rounded-xl`) · 24 cards (`rounded-card`) · 28 Home tiles, dialogs (`rounded-tile`) · 32 sheets (`rounded-sheet`) | |
| Shadow | `shadow-card` (0 1 3 / .08) · `shadow-raised` (.10, pills, switcher) · `shadow-float` (0 10 30 / .14, tab bar) · `shadow-toast` (.25) · `shadow-dialog` (0 20 50 / .30) | Shadows are ink-tinted, never pure black, in the light theme |
| Touch targets | 48 px for primary options (`min-h-touch`) · 44 px minimum for everything else (`min-h-touch-min`) · 52 px for primary buttons (`h-button`) | QL-02, principle 6 |
| Avatars | 24 inline · 30 in check cards · 32 in the switcher · 36 in rows · 48 for the other-profile shortcut · 72 on profile headers | Circle with the initial in Fredoka 600 |

### 2.8 Icons

- Use `lucide-react` with `strokeWidth={2}` and round caps and joins, matching the `.i` class in the mockups.
- Sizes are 16 in chips, 18 in rows and timeline circles, 20 on buttons, 22 in the tab bar and 24 in sheet headers.
- Lift custom drawings straight from the mockup SVGs:
  - Bristol 1 to 7 and infant-scale icons (S02, S20)
  - portion plates (S03)
  - the five mood faces (S05)
  - the enjoyment faces (S04)
  - the Phase 2 sleep bar (S28)
- Stool icons must be original drawings, not copies of published charts (BTH-03).
- Every icon is `aria-hidden`. Icon-only buttons get an `aria-label`.

### 2.9 Motion and haptics

- **Sheets:** slide up in 240 ms with `ease-sheet` (cubic-bezier 0.32, 0.72, 0, 1), and the overlay fades in.
- **Toasts:** fade and rise 8 px in 180 ms.
- **Chips:** change state instantly. Don't animate the check icon in.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, fade only, with no movement. `theme.css` already enforces this.
- **Haptics:** after a save, call `navigator.vibrate?.(10)` where it's supported (QL-04).

## 3. Layout

- **Phone-first.** Mockups are 390 × 844. Layouts must work from 320 to 430 px wide with no horizontal scroll. The primary options of every log sheet must fit without scrolling on 375 × 667 (QL-02), so chips wrap and only optional details scroll.
- **Tab screens:** header (page title or greeting, plus the profile switcher), then content, then the floating tab bar. Content scrolls under the tab bar.
- **Sheets:** on phones, the top of the sheet is 56 px below the top of the screen, leaving the overlay visible. At 768 px and up, a sheet becomes a centered dialog, 480 px wide at most, with 32 px corners.
- **Tablet and desktop** (PRD section 7):
  - At 1024 px and up, the tab bar becomes a left sidebar (240 px) and content is centered at up to 960 px.
  - Insights shows 2 to 3 cards per row.
  - Reports shows the builder and preview side by side.
- **Safe areas:** add `env(safe-area-inset-bottom)` to the tab bar offset and the sheet footer padding.

## 4. Components

Base components on shadcn/ui and Radix where noted. Sizes come from the mockups; states and accessibility rules are additions for the build.

### 4.1 Tab bar (S01 and every tab screen)

- **Items:** Log, Timeline, Insights, Reports, More, each an icon (22) over a label (12/800).
- **Container:** a floating white pill, inset 16 left and right and 18 from the bottom (plus the safe area), 68 tall, radius 34, padding 6, `shadow-float`.
- **Item:** radius 28. The active item uses the `--profile-tint` background, `--profile` text and `aria-current="page"`.
- **Night theme:** `--card` background with the night tint for the active item.

### 4.2 Profile switcher (S01, S10, S12)

- **The pill:** a white button, 44 tall, `shadow-raised`. It holds a 32 px avatar in the profile color, the name (15/800) and a chevron. Its label is "Switch profile. Current profile: Leo".
- **What it opens:** a sheet listing every profile (avatar, name, care stage) with "Add a person" at the end. This sheet isn't mocked.
- **Home shortcut:** Home also shows the other profile as a 48 px avatar with a 3 px white ring, for a one-tap switch.
- **Switching** sets `data-profile-color`, the header name, every sheet's title and the toast (AT-14).

### 4.3 Home greeting and banners (S01, S18)

- **Greeting:** "How's Leo doing?" in `display-1`.
- **Banner:** a white card, radius 24, padding 12. It holds:
  - a 48 px icon square (radius 16, amber `#FFE9A8` with `#5C3D00`)
  - a title (16/800) and a sub-line (14, muted)
  - an ink action pill, 44 tall ("Give", "Log feed")
- **Banner types (QL-08):** meds overdue or due, the BM alert, and the PRN follow-up (P1). Show at most two, most urgent first, and collapse the rest behind "Show all".
- **Dismissing:** a dismissed banner never comes back for the same event.

### 4.4 Module tile (S01, S18)

- **Grid:** 2 columns with a 12 px gap.
- **Tile:** at least 124 tall (the PRD minimum is 96), padding 16, radius 28, module background.
- **Contents:**
  - a 44 px white icon circle with the icon in the module ink
  - the label in `title-3`
  - a status line in 13/800: plain `--foreground-2` text, or a white pill with warning ink when it's an alert ("3 days since BM")
- **Medication tile:** spans both columns as a row (at least 80 tall, with a chevron): "2 of 3 given today".
- **Labels:** they follow the care stage (Appendix A): Diaper, Potty or Bathroom.
- **Behavior:** the whole tile is one button that opens the log sheet. Its accessible name is the label plus the status.

### 4.5 Quick taps (favorites, QL-09, P1)

- **Layout:** up to 6 buttons, each 76 wide with 16 px gaps: a 60 px white circle (`shadow-raised`, icon in the profile accent) with a 13/800 label underneath. A section heading "Quick taps" in `title-4` sits above.
- **Behavior:** one tap logs at the current time and shows the toast.
- **Before P1 ships:** hide the row.

### 4.6 Log sheet (S02 to S05, S07, S19, S20, S28, S29)

**Base:** shadcn Drawer (vaul) on phones; Dialog at 768 px and up.

**Anatomy, top to bottom:**

- Overlay in `--overlay`.
- Sheet: `--card` background with 32 px top corners.
- Grabber: 40 × 5, `--grabber`, 10 px from the top.
- Header (padding 12 20 4):
  - a 48 px module icon circle
  - the title in `title-1`
  - a sub-line "for Leo" (14/700, muted) after a 10 px profile-color dot
  - a close button: a 44 px `--secondary` circle labeled "Close"
- Body (padding 12 20 0): groups 14 to 16 apart, each led by a `label` heading in `--muted-foreground`.
- Footer: sticky, with a `--divider` top border and padding 12 20 28 plus the safe area. It holds the time chip (4.12) and a full-width Save (52, ink).

**Required choices:**

- The required group is preselected from the last-used value when that makes sense (QL-06).
- Otherwise Save is disabled (`aria-disabled`, 40% opacity) until the choice is made, with the hint "Pick what happened". Never hide Save.

**Closing:** close, Esc, the system back gesture and swiping down all close the sheet. If something has been selected, ask "Discard this entry?" first.

**Focus:** goes to the sheet title when it opens and returns to the tile when it closes.

### 4.7 Choice chip

- **Shape and size:**
  - A pill, at least 48 tall. The mockups show 44; the PRD wins.
  - Padding 0 16, text `body`.
- **Unselected:** `--secondary` fill with a 1 px `--border`.
- **Selected:** `--profile` fill and border, `--profile-on` text at 800, and a 16 px check icon before the label.
- **Semantics:**
  - A single-select group is a `radiogroup`: each chip is `role="radio"` with `aria-checked`, and arrow keys move between chips.
  - A multi-select group uses toggle buttons with `aria-pressed`.
  - The mockups use `aria-pressed` everywhere; the build should split them as above.
- **"More" chip:** dashed 1.5 px `--dashed-line` border, white, with a chevron. It opens the full option list in a sheet; options are per-profile (SET-04).
- **"Add" chip** ("Add food", "New activity"): same style with a plus. It opens a setup input, the only typing in a log flow (EAT-08, ACT-01).

### 4.8 Option tile

Icon choices: activities (S04), the stool scale (S02, S20) and portion plates (S03).

- **Grid:** 3 or 4 equal columns with 8 px gaps.
- **Tile:** at least 76 to 84 tall, radius 18, a 1.5 px `--border`, `--secondary` fill, an icon (24 to 28) over the label (12.5 to 14).
- **Selected:** a 2 px `--profile` border, `--profile-tint` fill and a 20 px check badge in the top-right corner.

### 4.9 Face scale (mood S05, enjoyment S04)

- **Layout:** five equal columns. Each is a 52 px circle face with a 12/700 label underneath.
- **Selected:** `--profile` fill, white face, and the label in `--profile-ink` at 800.
- **Labels:** they change with the care stage (Appendix A). Stored values are 1 to 5.

### 4.10 Segmented control (S05 intensity, S25 role, S29 intensity)

- **Container:** a pill with a 1 px `--border` and padding 3.
- **Segments:** equal width, at least 48 tall. The selected segment gets the `--profile` fill and a check icon.
- **Semantics:** it's a radio group.

### 4.11 Stepper (S07 dose, S19 and S27 amount)

- **Layout:** a 56 · 1fr · 56 grid inside a `--secondary` card with radius 24 and padding 12.
- **Buttons:** 56 px white circles, labeled "Less" and "More" (or "Decrease dose" and "Increase dose").
- **Value:** `display-1`, with a caption underneath that explains the default ("Same as last feed", "Saved dose").
- **Steps:** 0.5 oz or 10 ml for bottles. For doses, the step is the medication's dose step, and a "Half dose" chip halves the saved dose.
- **Amount chips:** a row of equal-width chips below (EAT-03 lists the full set).
- **Units:** stored in canonical units, shown in the user's units (SET-01).

### 4.12 Time chip and time picker (every sheet footer)

- **The chip:** a footer pill, 52 tall, with a 1 px `--border-strong` border and white fill. It holds a clock icon, "Now" and a chevron, and is labeled "Time: now. Change time".
- **What it opens** (QL-03, not mocked): presets for Now, 15 min ago, 30 min ago, 1 h ago and 2 h ago, plus Custom. Custom opens a date-time picker that blocks future times.
- **Variants:** sleep (S28) shows a date chip ("Mon, Oct 26"), and an incident (S29) shows its actual time.

### 4.13 "Add details" disclosure (QL-05)

- **Closed:** 52 tall, radius 16, `--secondary` fill. It shows "Add details" (15/800), a 13 px muted summary of what's inside, and a chevron that rotates when it opens. It's collapsed by default.
- **Open:** it expands in place with:
  - a note field that works with dictation
  - the "Flag for doctor" switch
  - the module's optional chips
- **When there's no room:** the sheet footer shows a 52 px pencil button labeled "Add a note or flag for doctor" (S29).

### 4.14 Switch (S11)

- **Element:** `role="switch"` with a 56 × 32 track inside a 60 × 44 hit area.
- **On:** `--profile` track with a 26 px white knob on the right.
- **Off:** `--switch-off` track with the knob on the left.
- **Label:** on the left with a description underneath ("Shows up in the next doctor report").

### 4.15 Stool color swatch (S02, S20)

- **Swatch:** a 40 px circle with a 12.5 px label underneath.
- **Selected:** a two-ring outline (`box-shadow: 0 0 0 3px var(--card), 0 0 0 5px var(--profile)`) and a check in a contrasting color.
- **Pale:** gets a 1.5 px border.
- **Other:** dashed, with a plus.

### 4.16 Inline notice (S20, S07, S09)

- **Shape:** radius 18, padding 14, a 1 px border in the tone color, and an icon. It can have a title (15/800) and body text (14), with an optional outlined action button (44 tall).
- **Tones:**
  - warning: "Worth mentioning to your doctor" with "Flag for doctor" (BTH-06). Baby profiles get the pale-stool sentence from BTH-06, as in S20.
  - info: "Enter the dose your doctor or pharmacist gave you…" (MED-11)
  - flag/urgent: "If this is happening now, call 911" (EAT-06)
- **Clinical copy:** it comes from the PRD, and a clinician reviews it (D4).

### 4.17 Toast with Undo (S18, QL-04)

- **Position:** above the tab bar (bottom 100 plus the safe area, 16 from each side), or above the sheet footer.
- **Shape:** radius 20, `--toast` background, padding 8 8 8 16.
- **Contents:**
  - a 28 px check circle in the profile accent
  - the title (14/800): "Wet diaper logged for Maya"
  - the time in 13 px `--toast-muted`
  - an Undo button: 44 tall, radius 14, `--toast-action` background, 15/800
- **Timing:** it stays at least 5 s, and pauses while hovered or focused.
- **Semantics:** `role="status"`, announced politely.
- **Undo:** removes the entry on every device (AT-02).

### 4.18 Alert dialog: duplicate-dose check (S08, MED-07)

- **Base:** Radix AlertDialog over `--overlay-strong`.
- **Card:** centered, radius 28, padding 24, `shadow-dialog`.
- **Contents:**
  - a 56 px warning icon circle
  - the title in `title-2`, centered: "Ibuprofen was already given 1 h 5 min ago"
  - body text (15, `--foreground-2`): who gave it, when, and the interval setting
- **Buttons:** stacked, full width.
  - Primary (ink): "Don't log this dose". It's the default and has focus.
  - Outlined: "Log another dose anyway". It saves with `duplicate_override: true`.
- **Footnote** (13, muted): "Not sure? Check with Leo's doctor or pharmacist."
- **Other uses:** the same pattern covers deleting an entry and removing a caregiver; those use a destructive primary button.

### 4.19 Timeline (S10)

- **Filter chips:** a horizontal, scrollable row (All, Bathroom, Eating, Mood, Activity, Meds).
- **Day header:** `title-4` ("Today · Mon, Oct 26") plus a summary line in 13/700 muted: "3 meals · mood 3.2 average · meds 2 of 3" (TL-04).
- **Rows** sit in a white card (radius 24) and are at least 64 tall, padding 8 14. Each row has:
  - the time: 13/800, `--foreground-2`, 62 px wide, `tabular-nums`
  - a 36 px module icon circle
  - the title (15/800) and a detail line (13, muted)
  - badges (the "For doctor" flag pill)
  - the caregiver pill: 12.5/800 on `--secondary`
- **Interaction:** the whole row is a link to the edit sheet.
- **Not mocked:** a "Waiting to sync" marker (TL-01): a small dashed-clock icon and 12 px muted text.

### 4.20 Insight cards (S12 to S14)

- **Today card:**
  - module background, radius 24, at least 150 tall, padding 16
  - a module label (14/800, module ink, with icon)
  - the value in `display-2`
  - a caption (14/700) and a footnote (13)
  - Tapping it opens that module's Trends.
- **Trend card:**
  - white, radius 24, padding 16
  - a kicker (module label), then the headline in `title-4`, the chart, a caption (13, muted) and "View as table" (DSH-11)
- **Pattern card:**
  - a kicker with an icon in the module ink
  - the headline in `title-4`, then the visualization
  - a meta line: "Last 30 days · 84 mood logs"
  - "How we calculated this", which opens a sheet that isn't mocked
  - a footer with the exact DSH-13 copy "Patterns aren't proof of cause. Share them with your care team." and an outlined "Add to report" button (DSH-12, P1)

### 4.21 List rows (S22)

- **Card:** grouped rows in a white card with radius 24.
- **Rows:** at least 60 tall for people and caregivers, 56 for settings. Each has a 36 px avatar or icon, a title (16/800), a sub-line (13, muted), and a trailing value (13, muted) plus a chevron.
- **Action rows** ("Add a person", "Invite a caregiver"): `--profile-ink` text and a dashed-circle icon.

### 4.22 Radio cards and check cards (S21, S23, S25)

- **Real inputs:** use native `input type="radio"` or `input type="checkbox"` (22 px, `accent-color: var(--profile)`) inside a `<label>` card.
- **Radio card** (role choice, age group): at least 64 tall, padding 8 16, radius 20, a 1.5 px `--border` on white. It has a title (15/800) and a one-line description (13, muted).
- **Check card** (people): at least 56 tall, padding 0 14, radius 18, with a 30 px avatar and the name (16/800).
- **Selected:** a 2 px `--profile` border and `--profile-tint` fill.

### 4.23 Buttons

| Variant | Spec |
| --- | --- |
| Primary | `--primary` fill, `--primary-foreground` text, 52 tall, pill, `body-lg`. Night theme: profile accent fill with dark text. |
| Small action | Ink pill, 44 tall, 16/800 ("Give", "Log feed") |
| Outlined | White, 1.5 px `--border-strong` border, 44 to 52 tall |
| Destructive | White, 1.5 px `--destructive-border` border, `--destructive` text, trash icon |
| Text link | `--profile-ink`, 800 weight, no underline (underline on hover and focus) |
| Icon button | A 44 px circle in `--secondary` (or white on `--background`) with an `aria-label` |

Disabled buttons are 40% opacity with `aria-disabled`. Every interactive element shows a 2 px `--ring` focus outline with a 2 px offset.

### 4.24 Text input (setup only, S09, S21, S23)

- **Field:** 52 tall, radius 16, a 1.5 px `--input` border, white fill and 16 px text.
- **Label:** above the field (14/800, muted), always visible. Placeholders are examples only.
- **Units:** an attached button ("mg ▾") opens the unit list (Appendix A).

## 5. Patterns and states

- **Logging in 3 taps:** tile, then choice, then Save. The sheet closes, the entry appears optimistically, the toast shows Undo, and the tile's status updates to "just now" (AT-01).
- **Smart defaults (QL-06):** preselect last-used values and say so in captions: "Same as last feed", "Saved dose", "Picked by time of day", "Start on right" (the last breast side).
- **Editing (TL-02, TL-05, S11):**
  - The edit sheet shows label and value rows, and each row opens the same picker the log sheet uses.
  - Changing Person moves the entry to another profile.
  - The edit history lists every change with who and when.
  - Delete asks for confirmation, then goes to Recently deleted (TL-06, P1).
- **Flag for doctor:** a switch in "Add details" or in the edit sheet. Flagged entries get the "For doctor" pill on the Timeline and appear in the report's "Flagged for the doctor" table.
- **First run and empty states** (not mocked):
  - Home on first run shows tiles reading "Nothing logged yet" and three one-line tips (onboarding step 5).
  - An empty Timeline day reads "Nothing logged this day".
  - Patterns below the data minimum shows a "Keep logging" card with progress in the profile accent, for example "Patterns appear after 14 days of mood logs · 10 of 14 days" (AT-11).
- **Offline and sync** (not mocked):
  - An info banner under the header reads "You're offline. Entries will sync when you're back."
  - Rows waiting to sync show a marker.
  - Logging is never blocked (AT-08).
- **Loading:** skeleton blocks in `--muted` match the card shapes. Saving is optimistic, so a spinner never appears after Save (PRD section 9: toast within 100 ms).
- **Errors:** an inline warning-tone notice with Retry. A failed sync stays in the outbox and is retried; never drop a tap.

## 6. Charts (Recharts)

- **Card order:** headline sentence, chart, caption (range and sample size), "View as table".
  - Headlines compare periods when both have data (DSH-10).
  - Without a comparison, the headline states the fact ("About 1 BM a day; none in the last 3 days").
- **Series:**
  - The mood line is `--chart-mood`, 2.5 px wide, with an end dot.
  - BM bars are the bathroom ink, 10 px wide with 2 px corners.
  - Comparison bars are `--chart-neutral`, and the bar being called out is `--chart-highlight`, with its value label in `--chart-highlight-ink`.
- **Medication-change markers (DSH-08):**
  - Draw them as vertical dashed lines (5 4) in `--chart-marker`, labeled at the top ("Melatonin started", 12/800).
  - Tapping a marker opens a popover with the change and its effective date.
- **Before and after averages:** dotted horizontal lines (2 3) in `--foreground-2`, labeled directly.
- **Threshold bands** (for example "No BM Oct 24 to 26"): `--chart-band` fill with the label in `--chart-band-ink`.
- **Axes:** 12 px muted labels and `--chart-grid` gridlines, with no chart border. The mood axis runs 1 to 5 with the caption "1 = very upset, 5 = great".
- **Accessibility:**
  - Each chart has `role="img"` and an `aria-label` that repeats the headline and range.
  - Direct labels mean color isn't needed, and every chart must read in grayscale.
  - The table view lists the same numbers.
- **Time of day** uses each entry's local time zone (PRD section 11).

## 7. Doctor report (print, RPT-02 and RPT-03, S16 and S17)

**Page:**

- Letter is 816 × 1056 CSS px at 96 dpi; A4 is 794 × 1123.
- Page padding is 56 px at the top and bottom and 72 px at the sides.
- Use `@page { size: letter; margin: 0 }` and padding on the page container, or `@page { margin: 0.6in 0.75in }`.

**Type:**

- Nunito throughout. The patient's name is 30/800, section headings 18/800, body and tables 14/1.45, and footnotes 12 to 13. Nothing is under 12 px.

**Color:**

- Ink and grays, plus the profile accent for the header rule and brand mark.
- Everything must read in grayscale: dashed versus solid lines, direct labels, and gray bands instead of colored ones.

**Section order** for the default Doctor visit template:

1. Header: brand, report title, "Page X of Y".
2. Patient block: name, age, date of birth, period, "prepared by … for …".
3. Allergies and care notes (ACC-12, RPT-09).
4. Current medications table: dose, schedule, start date, "given in period" with a percentage (MED-10), and a line for changes in the period.
5. A 30-day summary: four stat boxes.
6. Mood chart with markers and before/after averages.
7. Bathroom chart.
8. Behaviors table.
9. Flagged for the doctor.
10. Patterns the app noticed, with the "not proof of cause" line.
11. Questions for this visit (RPT-08, P1).
12. Footer on every page: "Made with Behavior Logger from caregiver entries. Not a medical record or diagnosis."

**Page-break rules:**

- Never split a chart or table row across pages (`break-inside: avoid`), and repeat table headers on every page.
- The default 30-day report must fit in 3 pages or fewer (the mockup fits in 2).

**Build:** a print route such as `/reports/[id]/print` with print CSS, exported through the browser's Print or Save as PDF (P0). A generated PDF comes later (RPT-05, P1).

## 8. Dark theme (SET-02, P0) and night mode (SET-03, P1)

**The setting:** `data-theme` on `<html>` is `light`, `dark` or `night`. Store the choice per device. "System" follows `prefers-color-scheme` between light and dark only; night is never picked automatically by System.

**Night mode (mocked in S26 and S27):**

- Warm, dim and low-glare, for logging at 3 AM.
- **Colors:**
  - No pure white anywhere.
  - Primary buttons use the profile's night accent with dark text, to avoid a bright block.
  - Amber `#F2B66B` is kept for sleep and moon actions.
- **Header:**
  - The page title becomes "Quiet hours", with "Night mode is on until 6:00 AM" underneath.
  - A moon button (amber) shows the mode is on; tapping it turns the mode off.
- **Content:**
  - A sleep status card ("Awake since 2:50 AM", with "Back asleep") sits above the tiles.
  - One-tap buttons are labeled "One tap".
- **Auto-on:** the mode can turn on automatically between set hours. The default is off; when it's on, the default window is 8 PM to 6 AM.

**Dark theme (not mocked):** derived from the same palette, cool rather than warm. The layouts are identical, and all tokens are in `theme.css`. Run axe and the screenshot tests in all three themes.

## 9. Copy and voice

- **Tone:** warm, plain and short. Use sentence case, and no exclamation marks in health contexts.
- **Names, not pronouns:** "How did Leo sleep?", "for Maya". An adult is never described in baby words; follow the wording table in PRD Appendix A.
- **Numbers and time:** "3 days since BM", "2 of 3 given today", "Last given 6:00 PM by Dad (1 h 5 min ago)". Use 12-hour time with AM and PM by default (SET-01).
- **Missed doses:** never say "Missed". Say "Not logged" until a caregiver marks Skipped (MED-08).
- **Exact strings to keep:**
  - "Patterns aren't proof of cause. Share them with your care team." (DSH-13)
  - "Worth mentioning to your doctor" (BTH-06), plus the baby pale-stool sentence from BTH-06 word for word
  - "If this is happening now, call 911." (EAT-06)
  - "Enter the dose your doctor or pharmacist gave you. The app never suggests doses."
  - "Made with Behavior Logger from caregiver entries. Not a medical record or diagnosis."
- **Strings:** every string is externalized with next-intl (SET-08), including chip labels and notices.

## 10. Known differences between the mockups and the PRD (the PRD wins)

| Where | Mockup shows | Build this | Source |
| --- | --- | --- | --- |
| Chips, segments, small buttons | 44 px tall | At least 48 px for primary options; 44 px for everything else | QL-02, principle 6 |
| Tab labels, chart labels | 11 to 11.5 px | 12 px minimum | Legibility, 200% text scaling |
| Text-field borders (S09, S21, S23) | `#CFC6E3` | `--input` (`#8E85AD`) | WCAG 1.4.11 |
| Bottle amount chips (S19, S27) | 2 to 8 oz, 6 chips | oz 1, 2, 3, 4, 5, 6, 8 or ml 30 to 240 | EAT-03 |
| As-needed reasons (S07) | 7 reasons | Add Constipation | MED-06, Appendix A |
| Medication forms (S09) | 5 visible | Full list from Appendix A behind "More" | MED-01 |
| Report templates (S15) | Doctor visit, Therapist, School | Add Custom | RPT-01 |
| Timeline caregiver label (S10) | Short names ("Mom") | Short display name; initials when it's longer than 8 characters | ACC-11, TL-01 |
| Bristol labels (S02) | Short labels ("4 Smooth") | Keep the short chip labels; show the full Appendix A wording in an info sheet | BTH-03 |
| Chip semantics | `aria-pressed` everywhere | Radio semantics for single-select groups | WCAG 4.1.2 |
| Pattern footer (S14) | "Share them with Leo's care team." | "Share them with your care team." | DSH-13 |
| Notice title (S20) | "Worth a call to Maya's doctor" | "Worth mentioning to your doctor". The baby pale-stool sentence stays as written. | BTH-06 |
| Tile status after a save (S18) | "Wet · just now" | Keep the mockup format. Have the AT-01 test check for "just now" rather than the literal "Last: just now". | QL-01, AT-01 |
| Sleep and behavior incidents (S28, S29) | Designed | Don't build in the MVP. Keep entry types open (QL-14). | Phase 2 |
| Per-person caregiver access (S22, S23, S25) | "Who can they see?" and "Grandma · Leo only" | Not in the PRD. Decision D12 below. | Scope |

## 11. Not mocked: build these from the PRD with the components above

- Sign up and sign in (ACC-01, ACC-02), and an expired-invite state.
- Profile switcher sheet (4.2).
- Time picker (4.12).
- Onboarding steps 2 and 3: confirm modules; add medications or invite a caregiver; then the tips.
- Drinks and breastfeeding sheets (EAT-02, EAT-05).
- Teen and adult wording (Appendix A).
- Day-level mood prompt after 6 PM (MOOD-06, P1).
- Medication history and dose changes with an "effective from" date (MED-09).
- As-needed medication setup with a minimum interval (MED-03).
- "Did it help?" follow-up (MED-12, P1).
- "How we calculated this" sheet.
- Report preview toggles, and the CSV export confirmation.
- Care card (ACC-12, P1).
- Units and alerts (SET-01, SET-05).
- Theme setting (SET-02, SET-03).
- Export or delete data (SET-06, SET-07).
- Recently deleted (TL-06, P1).
- Offline banner and empty states (section 5).
- Tablet and desktop layouts (section 3).

## 12. Accessibility (design side of WCAG 2.2 AA)

- **Contrast:** checked for all three themes and every profile and module color: 276 pairs, all passing.
  - Text needs 4.5:1.
  - Selection, focus rings, input borders, switch tracks and chart marks need 3:1.
  - Run `node design/scripts/check-contrast.mjs` after any token change, and add it to CI. It exits 1 on failure. The pair closest to its limit is the teal tab label on the teal tint, at 4.50:1.
- **Targets:** 48 px for primary options and 44 px minimum for everything else.
- **State:** every selected state uses more than color: a check icon, a border change and ARIA state.
- **Dialogs and sheets:** they trap focus, close with Esc, return focus to what opened them, and use `aria-modal`. The duplicate-dose check is an `alertdialog`.
- **Live regions:** toasts use `role="status"`. The offline banner and sync errors use `role="alert"` only when the user must act.
- **Charts:** `role="img"` with a summary, plus the table view (DSH-11).
- **Motion and zoom:** honor reduced motion, support 200% text, and never scroll horizontally at 320 px.
- **Testing:** run axe in CI for every screen in each theme, and do a screen-reader pass of the five log flows (PRD section 9).

## 13. Open design decisions

- **D12 · Per-person caregiver access.** The invite and caregiver screens let an admin limit a caregiver to some profiles ("Grandma · Leo only"). PRD ACC-07 and ACC-09 grant household-wide access.
  - Recommendation: add a `member_profile_access (member_id, profile_id)` table now, where no rows means all profiles, and enforce it in row-level security.
  - Ship the UI in the MVP if David agrees; otherwise hide "Who can they see?" and keep the table.
- **D11 · Name and brand (from the PRD).** The heart in a rounded square is a placeholder mark. Keep it isolated in one `Logo` component so a rebrand is one change.
