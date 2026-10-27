-- Behavior Logger — M2 initial schema
-- Tables, indexes and updated_at triggers.

-- ─── Households ──────────────────────────────────────────────────────────────

create table households (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  settings   jsonb       not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table households is
  'One household per family; holds shared settings (units, locale).';

-- ─── Household members ───────────────────────────────────────────────────────

create table household_members (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references households(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  role         text        not null check (role in ('admin', 'caregiver', 'viewer')),
  display_name text        not null,
  initials     text        not null,
  access_from  timestamptz,
  created_at   timestamptz not null default now(),
  unique (household_id, user_id)
);

create index household_members_user_idx on household_members (user_id);

comment on table household_members is
  'Every person who can access this household. Surrogate PK lets member_profile_access keep a clean FK.';
comment on column household_members.access_from is
  'Paid-staff start date: entries before this timestamp are hidden for ACC-14 (future).';

-- ─── Invites ─────────────────────────────────────────────────────────────────

create table invites (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references households(id) on delete cascade,
  email        text        not null,
  role         text        not null check (role in ('admin', 'caregiver', 'viewer')),
  token        uuid        not null unique default gen_random_uuid(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  created_by   uuid        not null references household_members(id),
  created_at   timestamptz not null default now()
);

comment on column invites.token is
  'Random UUID; shared in the invite link. Acceptance goes through accept_invite() to avoid RLS bypass.';

-- ─── Profiles ────────────────────────────────────────────────────────────────

create table profiles (
  id              uuid        primary key default gen_random_uuid(),
  household_id    uuid        not null references households(id) on delete cascade,
  name            text        not null,
  color           text        not null check (color in ('violet', 'teal', 'rose', 'amber', 'blue')),
  avatar          text,
  dob             date,
  care_stage      text        not null check (care_stage in ('baby', 'child', 'teen_adult')),
  toileting       text        not null default 'diapers'
                              check (toileting in ('diapers', 'training', 'toilet')),
  feeding_methods text[]      not null default '{}',
  enabled_modules text[]      not null default '{}',
  settings        jsonb       not null default '{}',
  care_card       jsonb       not null default '{}',
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_household_idx on profiles (household_id) where archived_at is null;

comment on column profiles.color is
  'Design-token name: maps to CSS var(--profile-*) via data-profile-color attribute.';
comment on column profiles.settings is
  'Alert thresholds (bm_alert_days, wet_diaper_min, med_dose_window_min). Schema: ProfileSettingsSchema in lib/schemas/household.ts.';
comment on column profiles.care_card is
  'Allergies, conditions, contacts, calming tips (ACC-12). All fields optional.';

-- ─── Per-caregiver profile access (D12) ─────────────────────────────────────
-- Empty rows for a member = that member sees ALL profiles in the household.
-- Any row restricts them to only the listed profiles.

create table member_profile_access (
  member_id  uuid not null references household_members(id) on delete cascade,
  profile_id uuid not null references profiles(id)          on delete cascade,
  primary key (member_id, profile_id)
);

comment on table member_profile_access is
  'D12 profile access control. If no rows exist for a member they can see every profile.';

-- ─── Entries ─────────────────────────────────────────────────────────────────
-- id is CLIENT-GENERATED (no default) to support the IndexedDB outbox.
-- type is text so Phase-2 types (sleep, ABC) need no schema migration.

create table entries (
  id                 uuid        primary key,
  household_id       uuid        not null references households(id) on delete cascade,
  profile_id         uuid        not null references profiles(id)   on delete cascade,
  type               text        not null,
  occurred_at        timestamptz not null,
  tz                 text        not null default 'UTC',
  ended_at           timestamptz,
  data               jsonb       not null default '{}',
  note               text,
  flagged_for_doctor boolean     not null default false,
  logged_by          uuid        not null references auth.users(id),
  logged_by_name     text        not null,
  logged_by_initials text        not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  schema_version     integer     not null default 1
);

-- Partial indexes exclude soft-deleted rows to keep active queries fast.
create index entries_profile_type_time_idx
  on entries (profile_id, type, occurred_at desc)
  where deleted_at is null;

create index entries_profile_time_idx
  on entries (profile_id, occurred_at desc)
  where deleted_at is null;

create index entries_household_time_idx
  on entries (household_id, occurred_at desc)
  where deleted_at is null;

-- Full index for admin soft-delete recovery (TL-06).
create index entries_deleted_idx on entries (household_id, deleted_at)
  where deleted_at is not null;

comment on column entries.id is
  'Client-generated UUID from the IndexedDB outbox; no server default.';
comment on column entries.logged_by_name is
  'Snapshot of display_name at log time so attribution survives member removal (ACC-10).';
comment on column entries.tz is
  'IANA time zone string. Charts use local time for time-of-day views (DSH-05).';

-- ─── Entry revisions ─────────────────────────────────────────────────────────

create table entry_revisions (
  id           uuid        primary key default gen_random_uuid(),
  entry_id     uuid        not null references entries(id)     on delete cascade,
  household_id uuid        not null references households(id)  on delete cascade,
  changed_by   uuid        not null references auth.users(id),
  changed_at   timestamptz not null default now(),
  before       jsonb       not null,
  after        jsonb       not null
);

create index entry_revisions_entry_idx on entry_revisions (entry_id, changed_at desc);

comment on table entry_revisions is
  'Append-only edit history (TL-05). No UPDATE or DELETE policy is defined on this table.';

-- ─── Medications ─────────────────────────────────────────────────────────────

create table medications (
  id                  uuid        primary key default gen_random_uuid(),
  household_id        uuid        not null references households(id) on delete cascade,
  profile_id          uuid        not null references profiles(id)   on delete cascade,
  name                text        not null,
  form                text,
  strength            text,
  default_dose        numeric     not null,
  dose_unit           text        not null,
  kind                text        not null check (kind in ('scheduled', 'prn')),
  schedule            jsonb,
  dose_window_min     integer     not null default 60,
  min_interval_hours  numeric,
  purpose             text,
  prescriber          text,
  instructions        text,
  start_date          date,
  end_date            date,
  active              boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index medications_profile_idx on medications (profile_id) where active;

comment on column medications.schedule is
  'JSON: { "times": ["08:00","20:00"], "days": [0,1,2,3,4,5,6] }. Days: 0=Sun … 6=Sat.';
comment on column medications.min_interval_hours is
  'Set from the label or prescriber. Drives the duplicate-dose guard (MED-07). Null = use 1 h default.';

-- ─── Medication changes ───────────────────────────────────────────────────────

create table medication_changes (
  id            uuid        primary key default gen_random_uuid(),
  household_id  uuid        not null references households(id)  on delete cascade,
  medication_id uuid        not null references medications(id) on delete cascade,
  change_type   text        not null
                check (change_type in ('started', 'stopped', 'dose_changed', 'schedule_changed')),
  effective_at  date        not null,
  before        jsonb       not null,
  after         jsonb       not null,
  changed_by    uuid        not null references auth.users(id),
  created_at    timestamptz not null default now()
);

create index med_changes_med_idx on medication_changes (medication_id, effective_at desc);

comment on table medication_changes is
  'Immutable change log. Drawn as vertical markers on trend charts (DSH-08).';

-- ─── Option lists ─────────────────────────────────────────────────────────────
-- Custom activities, foods, feelings, behaviors, PRN reasons.

create table option_lists (
  id           uuid    primary key default gen_random_uuid(),
  household_id uuid    not null references households(id) on delete cascade,
  profile_id   uuid    references profiles(id) on delete cascade,
  module       text    not null,
  key          text    not null,
  label        text    not null,
  icon         text,
  sort_order   integer not null default 0,
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (household_id, profile_id, module, key)
);

-- ─── Favorites ───────────────────────────────────────────────────────────────

create table favorites (
  id             uuid        primary key default gen_random_uuid(),
  household_id   uuid        not null references households(id) on delete cascade,
  profile_id     uuid        not null references profiles(id)   on delete cascade,
  label          text        not null,
  entry_template jsonb       not null,
  sort_order     integer     not null default 0,
  created_at     timestamptz not null default now()
);

-- ─── Appointments ────────────────────────────────────────────────────────────

create table appointments (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references households(id) on delete cascade,
  profile_id   uuid        not null references profiles(id)   on delete cascade,
  date         date        not null,
  provider     text,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ─── Audit events ────────────────────────────────────────────────────────────

create table audit_events (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references households(id) on delete cascade,
  user_id      uuid        not null references auth.users(id),
  action       text        not null,
  target       text,
  at           timestamptz not null default now()
);

create index audit_events_household_time_idx on audit_events (household_id, at desc);

comment on table audit_events is
  'Written by SECURITY DEFINER triggers only; no client INSERT policy. Satisfies CMIA audit requirements.';

-- ─── updated_at trigger ──────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger households_updated_at
  before update on households
  for each row execute function set_updated_at();

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger entries_updated_at
  before update on entries
  for each row execute function set_updated_at();

create trigger medications_updated_at
  before update on medications
  for each row execute function set_updated_at();
