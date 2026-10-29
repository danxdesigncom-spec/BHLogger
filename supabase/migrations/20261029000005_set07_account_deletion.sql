-- Behavior Logger — M12e SET-07: delete your own account.
--
-- 1. Rows that name the person who made them (entries.logged_by, entry_revisions.changed_by,
--    medication_changes.changed_by, audit_events.user_id) pointed at auth.users with no ON DELETE
--    rule, so a caregiver who had logged anything could never be deleted. They now become NULL
--    when the user is deleted. Entries keep logged_by_name and logged_by_initials, so the household
--    record still says who logged them (as ACC-10 does for removed caregivers). With no author left,
--    only an admin can edit or delete those entries, which the existing policies already allow.
-- 2. invites.created_by pointed at household_members with no rule, so removing a member who had
--    sent invites failed. Their invites are now deleted with them.
-- 3. delete_my_account() does the household side in one transaction, with the role rule enforced
--    here. The server then deletes the auth user with the service-role key (never in the client).

alter table entries            alter column logged_by  drop not null;
alter table entry_revisions    alter column changed_by drop not null;
alter table medication_changes alter column changed_by drop not null;
alter table audit_events       alter column user_id    drop not null;

alter table entries
  drop constraint if exists entries_logged_by_fkey,
  add  constraint entries_logged_by_fkey foreign key (logged_by) references auth.users(id) on delete set null;
alter table entry_revisions
  drop constraint if exists entry_revisions_changed_by_fkey,
  add  constraint entry_revisions_changed_by_fkey foreign key (changed_by) references auth.users(id) on delete set null;
alter table medication_changes
  drop constraint if exists medication_changes_changed_by_fkey,
  add  constraint medication_changes_changed_by_fkey foreign key (changed_by) references auth.users(id) on delete set null;
alter table audit_events
  drop constraint if exists audit_events_user_id_fkey,
  add  constraint audit_events_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

alter table invites
  drop constraint if exists invites_created_by_fkey,
  add  constraint invites_created_by_fkey foreign key (created_by) references household_members(id) on delete cascade;

-- Returns what happened on the household side:
--   'household_deleted'  the caller was the only member, so the household and everything in it is gone
--   'left_household'     the caller left; their entries stay, labeled with their name
--   'no_household'       nothing to do (for example a retry after the auth user couldn't be deleted)
-- Raises 'last_admin' when other members remain and nobody else is an admin.

create or replace function delete_my_account()
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_mem     household_members;
  v_members integer;
  v_admins  integer;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into v_mem from household_members where user_id = auth.uid() limit 1;
  if not found then
    return 'no_household';
  end if;

  -- Lock the household's member rows so two admins leaving at once can't leave it with none.
  perform 1 from household_members where household_id = v_mem.household_id for update;

  select count(*), count(*) filter (where role = 'admin')
  into   v_members, v_admins
  from   household_members
  where  household_id = v_mem.household_id;

  if v_members = 1 then
    delete from households where id = v_mem.household_id;
    return 'household_deleted';
  end if;

  if v_mem.role = 'admin' and v_admins = 1 then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;

  insert into audit_events (household_id, user_id, action, target)
  values (v_mem.household_id, auth.uid(), 'member.account_deleted', v_mem.id::text);

  delete from household_members where id = v_mem.id;
  return 'left_household';
end;
$$;

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
