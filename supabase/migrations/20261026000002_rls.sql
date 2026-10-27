-- Behavior Logger — M2 row-level security
-- Helper functions, SECURITY DEFINER write operations, and per-table policies.
-- All helpers are SECURITY DEFINER so they can read household_members without
-- triggering the policies on that table (avoids recursion).

-- ─── Enable RLS ──────────────────────────────────────────────────────────────

alter table households            enable row level security;
alter table household_members     enable row level security;
alter table invites                enable row level security;
alter table profiles               enable row level security;
alter table member_profile_access  enable row level security;
alter table entries                enable row level security;
alter table entry_revisions        enable row level security;
alter table medications            enable row level security;
alter table medication_changes     enable row level security;
alter table option_lists           enable row level security;
alter table favorites              enable row level security;
alter table appointments           enable row level security;
alter table audit_events           enable row level security;

-- ─── Helper: role of the current user in a household ─────────────────────────
-- Returns null when the user is not a member.

create or replace function get_member_role(p_household_id uuid)
returns text
language sql security definer stable
set search_path = public
as $$
  select role
  from   household_members
  where  household_id = p_household_id
    and  user_id = auth.uid()
  limit 1;
$$;

-- ─── Helper: true if the current user is any member of the household ─────────

create or replace function is_household_member(p_household_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where  household_id = p_household_id
      and  user_id = auth.uid()
  );
$$;

-- ─── Helper: all household_ids the current user belongs to ───────────────────

create or replace function my_household_ids()
returns setof uuid
language sql security definer stable
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid();
$$;

-- ─── Helper: true when the user can access a profile (respects D12) ──────────
-- Empty member_profile_access for this member means full access.

create or replace function can_access_profile(p_profile_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
    from   profiles p
    join   household_members hm
             on  hm.household_id = p.household_id
             and hm.user_id = auth.uid()
    where  p.id = p_profile_id
      and (
            -- No restriction rows for this member → full household access
            not exists (
              select 1 from member_profile_access
              where member_id = hm.id
            )
            -- Or this profile is explicitly allowed
            or exists (
              select 1 from member_profile_access
              where member_id  = hm.id
                and profile_id = p_profile_id
            )
          )
  );
$$;

-- ─── Privileged write: create household + first admin member ─────────────────
-- Bypasses INSERT policies (no client INSERT policy exists on these tables).

create or replace function create_household(
  p_name         text,
  p_display_name text,
  p_initials     text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_hid uuid;
begin
  insert into households (name)
  values (p_name)
  returning id into v_hid;

  insert into household_members (household_id, user_id, role, display_name, initials)
  values (v_hid, auth.uid(), 'admin', p_display_name, p_initials);

  insert into audit_events (household_id, user_id, action, target)
  values (v_hid, auth.uid(), 'household.created', v_hid::text);

  return v_hid;
end;
$$;

-- ─── Privileged write: accept an invite token ────────────────────────────────

create or replace function accept_invite(
  p_token        uuid,
  p_display_name text,
  p_initials     text
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_inv invites;
begin
  select * into v_inv
  from   invites
  where  token = p_token
    and  accepted_at is null
    and  expires_at > now();

  if not found then
    raise exception 'Invalid or expired invite';
  end if;

  insert into household_members (household_id, user_id, role, display_name, initials)
  values (v_inv.household_id, auth.uid(), v_inv.role, p_display_name, p_initials)
  on conflict (household_id, user_id) do nothing;

  update invites set accepted_at = now() where id = v_inv.id;

  insert into audit_events (household_id, user_id, action, target)
  values (v_inv.household_id, auth.uid(), 'member.joined', auth.uid()::text);
end;
$$;

-- ─── households ──────────────────────────────────────────────────────────────

create policy "members read own household"
  on households for select
  using (is_household_member(id));

create policy "admin updates household"
  on households for update
  using  (get_member_role(id) = 'admin')
  with check (get_member_role(id) = 'admin');

-- INSERT and DELETE handled by create_household() and account-deletion function.

-- ─── household_members ───────────────────────────────────────────────────────

create policy "members read household members"
  on household_members for select
  using (is_household_member(household_id));

-- INSERT is handled exclusively by create_household() and accept_invite().

create policy "admin updates member roles"
  on household_members for update
  using  (get_member_role(household_id) = 'admin')
  with check (get_member_role(household_id) = 'admin');

create policy "admin removes members"
  on household_members for delete
  using (get_member_role(household_id) = 'admin');

-- ─── invites ─────────────────────────────────────────────────────────────────

create policy "admin reads invites"
  on invites for select
  using (get_member_role(household_id) = 'admin');

create policy "admin creates invites"
  on invites for insert
  with check (
    get_member_role(household_id) = 'admin'
    -- Bind created_by to the caller's member row
    and created_by = (
      select id from household_members
      where household_id = invites.household_id
        and user_id = auth.uid()
    )
  );

create policy "admin deletes invites"
  on invites for delete
  using (get_member_role(household_id) = 'admin');

-- ─── profiles ────────────────────────────────────────────────────────────────

create policy "members read accessible profiles"
  on profiles for select
  using (can_access_profile(id));

create policy "admin creates profiles"
  on profiles for insert
  with check (get_member_role(household_id) = 'admin');

create policy "admin updates profiles"
  on profiles for update
  using  (get_member_role(household_id) = 'admin')
  with check (get_member_role(household_id) = 'admin');

-- Hard delete not permitted from the client; archiving uses update (archived_at).
-- Account deletion goes through a server-side function (SET-07).

-- ─── member_profile_access ───────────────────────────────────────────────────

create policy "members read own access rows"
  on member_profile_access for select
  using (
    exists (
      select 1 from household_members hm
      where  hm.id = member_profile_access.member_id
        and  (
               -- Admins see all access rows for their household
               get_member_role(hm.household_id) = 'admin'
               -- Members see their own rows
               or hm.user_id = auth.uid()
             )
    )
  );

create policy "admin manages profile access"
  on member_profile_access for insert
  with check (
    exists (
      select 1 from household_members hm
      where  hm.id = member_profile_access.member_id
        and  get_member_role(hm.household_id) = 'admin'
    )
  );

create policy "admin removes profile access"
  on member_profile_access for delete
  using (
    exists (
      select 1 from household_members hm
      where  hm.id = member_profile_access.member_id
        and  get_member_role(hm.household_id) = 'admin'
    )
  );

-- ─── entries ─────────────────────────────────────────────────────────────────

create policy "members read accessible entries"
  on entries for select
  using (can_access_profile(profile_id));

create policy "caregivers insert entries"
  on entries for insert
  with check (
    can_access_profile(profile_id)
    and get_member_role(household_id) in ('admin', 'caregiver')
    -- logged_by must be the authenticated user (ACC-11)
    and logged_by = auth.uid()
  );

create policy "author or admin can update entries"
  on entries for update
  using (
    can_access_profile(profile_id)
    and (logged_by = auth.uid() or get_member_role(household_id) = 'admin')
  )
  with check (
    can_access_profile(profile_id)
    and (logged_by = auth.uid() or get_member_role(household_id) = 'admin')
  );

create policy "author or admin can soft-delete entries"
  on entries for delete
  using (
    can_access_profile(profile_id)
    and (logged_by = auth.uid() or get_member_role(household_id) = 'admin')
  );

-- ─── entry_revisions ─────────────────────────────────────────────────────────

create policy "members read revisions"
  on entry_revisions for select
  using (is_household_member(household_id));

-- Inserted when an entry is updated; only admin/caregiver can update entries,
-- so this policy mirrors the entries update gate.
create policy "caregivers insert revisions"
  on entry_revisions for insert
  with check (
    is_household_member(household_id)
    and get_member_role(household_id) in ('admin', 'caregiver')
  );

-- No UPDATE or DELETE: revisions are append-only (TL-05).

-- ─── medications ─────────────────────────────────────────────────────────────

create policy "members read accessible medications"
  on medications for select
  using (can_access_profile(profile_id));

create policy "caregivers create medications"
  on medications for insert
  with check (
    can_access_profile(profile_id)
    and get_member_role(household_id) in ('admin', 'caregiver')
  );

create policy "caregivers update medications"
  on medications for update
  using  (can_access_profile(profile_id) and get_member_role(household_id) in ('admin', 'caregiver'))
  with check (can_access_profile(profile_id) and get_member_role(household_id) in ('admin', 'caregiver'));

create policy "admin archives medications"
  on medications for delete
  using (get_member_role(household_id) = 'admin');

-- ─── medication_changes ───────────────────────────────────────────────────────

create policy "members read medication changes"
  on medication_changes for select
  using (is_household_member(household_id));

create policy "caregivers record medication changes"
  on medication_changes for insert
  with check (
    is_household_member(household_id)
    and get_member_role(household_id) in ('admin', 'caregiver')
  );

-- Immutable once written: no UPDATE or DELETE policy.

-- ─── option_lists ────────────────────────────────────────────────────────────

create policy "members read option lists"
  on option_lists for select
  using (is_household_member(household_id));

create policy "caregivers create option list entries"
  on option_lists for insert
  with check (get_member_role(household_id) in ('admin', 'caregiver'));

create policy "caregivers update option list entries"
  on option_lists for update
  using  (get_member_role(household_id) in ('admin', 'caregiver'))
  with check (get_member_role(household_id) in ('admin', 'caregiver'));

-- ─── favorites ───────────────────────────────────────────────────────────────

create policy "members read favorites"
  on favorites for select
  using (is_household_member(household_id));

create policy "caregivers manage favorites"
  on favorites for insert
  with check (
    is_household_member(household_id)
    and get_member_role(household_id) in ('admin', 'caregiver')
  );

create policy "caregivers update favorites"
  on favorites for update
  using  (is_household_member(household_id) and get_member_role(household_id) in ('admin', 'caregiver'))
  with check (is_household_member(household_id) and get_member_role(household_id) in ('admin', 'caregiver'));

create policy "caregivers delete favorites"
  on favorites for delete
  using (is_household_member(household_id) and get_member_role(household_id) in ('admin', 'caregiver'));

-- ─── appointments ────────────────────────────────────────────────────────────

create policy "members read appointments"
  on appointments for select
  using (is_household_member(household_id));

create policy "caregivers manage appointments"
  on appointments for insert
  with check (
    is_household_member(household_id)
    and get_member_role(household_id) in ('admin', 'caregiver')
  );

create policy "caregivers update appointments"
  on appointments for update
  using  (is_household_member(household_id) and get_member_role(household_id) in ('admin', 'caregiver'))
  with check (is_household_member(household_id) and get_member_role(household_id) in ('admin', 'caregiver'));

create policy "caregivers delete appointments"
  on appointments for delete
  using (is_household_member(household_id) and get_member_role(household_id) in ('admin', 'caregiver'));

-- ─── audit_events ────────────────────────────────────────────────────────────

create policy "admin reads audit events"
  on audit_events for select
  using (get_member_role(household_id) = 'admin');

-- INSERT handled by SECURITY DEFINER functions only; no client INSERT policy.
