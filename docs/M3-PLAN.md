# M3 Plan: Auth, households, profiles, invites, roles

Screens S21–S25 · Requirements ACC-01, ACC-04–07, ACC-09, ACC-10, D12

**Done when:** Invite → join → land on Quick Log works end to end. Roles enforced.

---

## Scope

| Screen | Route | Priority |
|---|---|---|
| S21 Create a profile | `/onboarding/profile`, `/profiles/new` | P0 |
| S22 More tab | `/more` | P0 |
| S23 Invite a caregiver | `/more/caregivers/invite` | P0 |
| S24 Join from an invite | `/invite/[token]` (public) | P0 |
| S25 Manage a caregiver | `/more/caregivers/[memberId]` | P0 |
| Auth login | `/auth/login` | P0 |

---

## Ambiguities — please decide before coding starts

### A1: Email delivery for "Send invite"

The `invites` table stores a token. "Send invite" on S23 needs to send email, but the PRD doesn't name an email provider.

**Options:**
- **A1a** Use Supabase's built-in transactional email (configured in the Supabase dashboard). Free, zero extra dependencies, limited branding. Works immediately once the project is connected.
- **A1b** Add Resend (transactional email SaaS). Full control over templates, requires `RESEND_API_KEY` in `.env` and one new dependency.

**Recommendation:** A1a for M3 — ship the invite flow with Supabase's default email. The "Send invite" button creates the invite record and Supabase sends a plain email with the token link. Resend can replace it in M10 (reports + export) when we care about polish.

Either way, "Copy link" on S23 always works and is the fallback if email is unconfigured.

---

### A2: Onboarding steps 2 and 3

SCREENS.md says steps 2 and 3 are "not mocked": confirm modules (pre-checked by stage); optionally add meds or invite a caregiver; then land on Quick Log with three one-line tips (PRD §7).

**Questions:**
1. What are the three tips? PRD §7 says "first-time tips" but doesn't enumerate them. Proposal: "Logging takes 3 taps or fewer", "Data syncs across all caregivers in real time", "You can add medications anytime from the More tab."
2. Where do modules go? Proposal: a simple checkbox list of the modules enabled by stage (Baby: Bathroom, Feeding, Mood, Medication; Child: Bathroom, Eating, Activity, Mood, Medication). Pre-checked, toggleable. No separate UI detail — just the list.
3. Step 3 CTA: "Add a medication" (links into M5's med setup, which won't exist yet → stub for now) + "Invite a caregiver" (opens S23) + "Skip and start logging" (primary, goes to Quick Log).

**Proposed routes:** `/onboarding/profile` → `/onboarding/modules` → `/onboarding/done` (tips + CTAs → `/`).

State is carried via URL: `/onboarding/modules?profileId=<uuid>` after the profile is created on step 1.

---

### A3: `profile_ids` column on `invites`

The current `invites` schema has no column for the D12 "Who can they see?" profile restrictions shown on S23. Without it, the profile access checkboxes on S23 can't be persisted to the invite, and `accept_invite` can't apply restrictions on join.

**Proposed migration** (`20261026000003_invites_profile_ids.sql`):
```sql
ALTER TABLE invites
  ADD COLUMN IF NOT EXISTS profile_ids uuid[] NOT NULL DEFAULT '{}';
```

Empty array = full access (mirrors `member_profile_access`: no rows = full access). When non-empty, `accept_invite` inserts one row per profile ID into `member_profile_access`.

Also update `accept_invite` SECURITY DEFINER function:
```sql
-- after creating the household_member row:
IF array_length(v_invite.profile_ids, 1) > 0 THEN
  INSERT INTO member_profile_access (member_id, profile_id)
  SELECT new_member_id, unnest(v_invite.profile_ids);
END IF;
```

**This is the one hard-to-undo schema change in M3.** OK to proceed?

---

### A4: Onboarding redirect — where does the household check live?

After a new user signs in and hits `/auth/callback`, they get redirected to `/`. If they have no household yet, they should go to `/onboarding/profile`.

**Options:**
- **A4a** In middleware: queries the DB on every request (one extra round trip per page load for logged-in users without a household).
- **A4b** In `(app)/layout.tsx` server component: runs once per server render, triggers a redirect. No extra cost on subsequent navigations once the household exists (the redirect only fires when the query returns empty).

**Recommendation:** A4b — one query in the app layout, on the server. The layout already renders per-request. This is the same pattern used for `middleware.ts`'s auth check.

---

### A5: Invite token across the sign-in redirect (existing-account flow)

S24 has two CTAs: "Accept and create account" and "I already have an account." For the existing-account path the user signs in (magic link), goes through `/auth/callback`, and lands at `/` — but by then the invite token is gone from the URL.

**Options:**
- **A5a** Store token in a short-lived cookie before the redirect (`bl-invite-token`, `HttpOnly`, `Secure`, `SameSite=Lax`, 15-minute TTL). The callback route checks for it after exchanging the code.
- **A5b** Thread the token through the `next` query param: `/auth/login?next=/invite/{token}/accept`. The callback reads `next` and redirects there after sign-in.

**Recommendation:** A5b — simpler, no cookie management, works with the existing callback. After sign-in the user lands at `/invite/[token]` again (or `/invite/[token]/accept`), which checks auth and immediately calls `accept_invite`.

---

## File structure

```
app/
  auth/
    login/page.tsx            ← Rewrite stub: email field, "Send magic link" CTA
  invite/
    [token]/page.tsx          ← S24 (public, outside auth group)
  (app)/
    layout.tsx                ← Add household check → redirect /onboarding/profile
    onboarding/
      layout.tsx              ← Progress bar shell, no tab bar, no nav
      profile/page.tsx        ← S21 step 1 (create profile)
      modules/page.tsx        ← S21 step 2 (confirm modules)
      done/page.tsx           ← S21 step 3 (tips + optional actions)
    more/
      page.tsx                ← S22 (replace stub)
      caregivers/
        invite/page.tsx       ← S23
        [memberId]/page.tsx   ← S25
    profiles/
      new/page.tsx            ← S21 form reused in-app (no progress bar)

lib/
  actions/
    household.ts              ← createHousehold (wraps DB function)
    profiles.ts               ← createProfile, updateProfile
    invites.ts                ← createInvite (+ email), acceptInvite
    members.ts                ← updateMember (role + profileIds), removeMember

  context/
    household-provider.tsx    ← HouseholdProvider: profiles[], members[], activeProfId

supabase/migrations/
  20261026000003_invites_profile_ids.sql   ← ADD COLUMN profile_ids + update accept_invite
```

---

## Auth flow

```
New user:
  /auth/login → [enter email] → magic link sent
  → user clicks link → /auth/callback?code=… → exchanges code
  → (app)/layout: no household? → /onboarding/profile
  → steps 1–3 → /  (Quick Log)

Invited (new account):
  /invite/[token] → "Accept and create account"
  → /auth/login?next=/invite/[token] → magic link
  → /auth/callback → redirect to /invite/[token]
  → page detects auth, calls acceptInvite(token, displayName, initials)
  → /  (Quick Log)

Invited (existing account):
  /invite/[token] → "I already have an account"
  → /auth/login?next=/invite/[token] → magic link
  → /auth/callback → redirect to /invite/[token]
  → same as above
```

---

## Server actions

All server actions import from `lib/supabase/server` (never client). All call DB functions or insert via the Supabase client (anon key, user's session, RLS enforced). The service-role key is only used in `scripts/seed.ts`.

| Action | Wraps |
|---|---|
| `createHousehold(name, displayName, initials)` | `select create_household(...)` |
| `createProfile(householdId, fields)` | `insert into profiles` |
| `updateProfile(profileId, fields)` | `update profiles` |
| `createInvite(householdId, email, role, profileIds)` | `insert into invites`, then Supabase auth admin email |
| `acceptInvite(token, displayName, initials)` | `select accept_invite(...)` |
| `updateMember(memberId, role, profileIds)` | `update household_members` + diff `member_profile_access` |
| `removeMember(memberId)` | `delete from household_members` (last-admin guard first) |

---

## RLS and security notes

- `/invite/[token]` is a **public route** — add `/invite` to the public-routes list in `lib/supabase/middleware.ts`. The page fetches only the invite's household name, inviter's display name, and profile names (all read via a SECURITY DEFINER view or the existing `is_household_member` helper — need to decide). See A6 below.
- The last-admin guard runs in the `removeMember` / `updateMember` server action (not just UI): fetch all admins for the household; reject if demotion or removal would leave zero admins.
- `accept_invite` is already SECURITY DEFINER; no caller needs the service-role key.

### A6: Public read for invite preview

S24 shows the household name, inviter's name, and profile names/colors to an unauthenticated visitor. The current RLS blocks all reads from unauthenticated users.

**Options:**
- **A6a** Create a `SECURITY DEFINER` function `get_invite_preview(p_token uuid)` that returns `{ household_name, inviter_name, profiles: [{name, color}] }`. No RLS bypass on individual tables.
- **A6b** Use a Postgres view with `security_invoker = false` (SECURITY DEFINER view).
- **A6c** Use the Supabase service-role key in a server-side route handler to fetch the invite data. The key never reaches the client; this is a server component.

**Recommendation:** A6a — a single purpose-built SECURITY DEFINER function, minimal surface area, easy to audit. Goes in a new migration alongside the `profile_ids` column.

---

## Household context

`HouseholdProvider` wraps the `(app)` layout. It provides:
- `profiles: Profile[]` — all non-archived profiles the user can access
- `members: Member[]` — all household members (admin sees all; non-admin sees own record + others' display names only)
- `activeProfileId: string | null` — stored in a `bl-active-profile` cookie
- `setActiveProfile(id)` — updates cookie + re-renders

The `data-profile-color` attribute on `<html>` is updated by the provider via a `useEffect` that mirrors the active profile's color token.

---

## Tests to write

1. **Unit** (`lib/actions/__tests__/`)
   - `removeMember`: last-admin guard rejects demotion and removal when only one admin
   - `acceptInvite`: expired token returns error, already-accepted token returns error
   - `createInvite`: role and profileIds stored correctly

2. **RLS** (`supabase/tests/` or Vitest with Supabase local)
   - Viewer cannot insert entries
   - Caregiver cannot update another caregiver's entries
   - `get_invite_preview` returns data for valid token, null for expired
   - `member_profile_access` restricts `can_access_profile` correctly

3. **Playwright** (`tests/e2e/`)
   - Full invite flow: Admin sends invite → new user opens link → creates account → lands on Quick Log
   - Role gate: Caregiver user loads `/more` → does not see "Invite a caregiver" row
   - Last-admin guard: demoting the only admin shows an error, the role does not change

---

## What M3 defers

- Photo upload (ACC-05 photo, not initials) → P1
- Viewer role invite UI (S23 shows radio but SCREENS.md notes "P1") → the radio renders, but the Viewer role is already in the DB; this is just a label question
- "Units and alerts" and "Export or delete data" settings rows in S22 → render as stubs linking to their future screens
- Onboarding step 3 "Add a medication" CTA → stub (med setup is M5)

---

## Questions for David

1. **A1** — Supabase built-in email (A1a) or add Resend (A1b) for M3?
2. **A2** — Are the three onboarding tips correct? Any changes to steps 2 / 3?
3. **A3** — OK to add `profile_ids uuid[]` to `invites` and update `accept_invite`?
4. **A4** — Household check in `(app)/layout.tsx` (A4b) is fine?
5. **A5** — Token-in-`next`-param strategy (A5b) for the existing-account invite flow?
6. **A6** — `get_invite_preview` SECURITY DEFINER function (A6a) for the public invite page?
