-- Behavior Logger — M3 invites extension
-- Adds profile_ids to invites so D12 access restrictions can be set at invite
-- time and applied automatically by accept_invite.
-- Also adds get_invite_preview() for the public S24 join page.

-- ─── Add profile_ids to invites ───────────────────────────────────────────────

alter table invites
  add column if not exists profile_ids uuid[] not null default '{}';

-- ─── Update accept_invite to apply profile restrictions ──────────────────────

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
  v_inv    invites;
  v_mem_id uuid;
begin
  select * into v_inv
  from   invites
  where  token = p_token
    and  accepted_at is null
    and  expires_at > now();

  if not found then
    raise exception 'Invalid or expired invite';
  end if;

  -- Create or re-use a member row (idempotent via ON CONFLICT DO NOTHING)
  insert into household_members (household_id, user_id, role, display_name, initials)
  values (v_inv.household_id, auth.uid(), v_inv.role, p_display_name, p_initials)
  on conflict (household_id, user_id) do nothing
  returning id into v_mem_id;

  -- Fetch the member id if ON CONFLICT swallowed the insert
  if v_mem_id is null then
    select id into v_mem_id
    from   household_members
    where  household_id = v_inv.household_id
      and  user_id = auth.uid();
  end if;

  -- Apply profile restrictions (empty array = full access, no rows inserted)
  if array_length(v_inv.profile_ids, 1) > 0 then
    insert into member_profile_access (member_id, profile_id)
    select v_mem_id, unnest(v_inv.profile_ids)
    on conflict do nothing;
  end if;

  update invites set accepted_at = now() where id = v_inv.id;

  insert into audit_events (household_id, user_id, action, target)
  values (v_inv.household_id, auth.uid(), 'member.joined', auth.uid()::text);
end;
$$;

-- ─── Public invite preview (unauthenticated read) ─────────────────────────────
-- Returns the minimal data needed to render S24 without exposing PII beyond
-- what the invite recipient already knows.  Returns NULL if the token is
-- invalid, expired, or already accepted.

create type invite_preview as (
  household_name text,
  inviter_name   text,
  role           text,
  profiles       jsonb,   -- [{id, name, color}]
  expires_at     timestamptz,
  status         text     -- 'valid' | 'expired' | 'accepted'
);

create or replace function get_invite_preview(p_token uuid)
returns invite_preview
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_inv  invites;
  v_result invite_preview;
begin
  select * into v_inv from invites where token = p_token;

  if not found then
    return null;
  end if;

  if v_inv.accepted_at is not null then
    v_result.status := 'accepted';
    return v_result;
  end if;

  if v_inv.expires_at <= now() then
    v_result.status := 'expired';
    v_result.expires_at := v_inv.expires_at;
    return v_result;
  end if;

  select h.name into v_result.household_name
  from   households h where h.id = v_inv.household_id;

  select hm.display_name into v_result.inviter_name
  from   household_members hm where hm.id = v_inv.created_by;

  v_result.role := v_inv.role;
  v_result.expires_at := v_inv.expires_at;
  v_result.status := 'valid';

  -- Profiles the invitee will be able to see (all if profile_ids is empty)
  select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'color', p.color))
  into   v_result.profiles
  from   profiles p
  where  p.household_id = v_inv.household_id
    and  p.archived_at is null
    and  (
           array_length(v_inv.profile_ids, 1) is null
           or p.id = any(v_inv.profile_ids)
         );

  return v_result;
end;
$$;

-- ─── Register new function in Database types (documentation comment) ──────────
-- lib/supabase/types.ts must add get_invite_preview to its Functions map.
