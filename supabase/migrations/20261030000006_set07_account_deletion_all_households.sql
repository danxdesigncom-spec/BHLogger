-- Behavior Logger — M12e SET-07 fix: delete_my_account() covers every household the caller belongs to.
--
-- The first version read one membership (LIMIT 1, in no particular order). For someone in two households
-- it could act on either: refuse in one, or delete the other. Now it locks all of the caller's
-- households, refuses before changing anything if any of them would be left without an admin, and then
-- handles each one: a household where the caller is the only member is deleted, otherwise they leave it.
--
-- Returns 'household_deleted' when every household the caller was in is gone, 'left_household' when at
-- least one remains (with the caller's entries labeled by name), or 'no_household'.

create or replace function delete_my_account()
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_mem     household_members;
  v_members integer;
  v_admins  integer;
  v_result  text := 'no_household';
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  -- Lock the member rows of all the caller's households, in a fixed order, so two admins leaving at once
  -- can't leave a household with none.
  perform 1
  from   household_members
  where  household_id in (select household_id from household_members where user_id = auth.uid())
  order  by household_id, id
  for update;

  -- Check every household first: nothing changes unless all of them can be left.
  for v_mem in select * from household_members where user_id = auth.uid() loop
    select count(*), count(*) filter (where role = 'admin')
    into   v_members, v_admins
    from   household_members
    where  household_id = v_mem.household_id;

    if v_members > 1 and v_mem.role = 'admin' and v_admins = 1 then
      raise exception 'last_admin' using errcode = 'P0001';
    end if;
  end loop;

  for v_mem in select * from household_members where user_id = auth.uid() loop
    select count(*) into v_members from household_members where household_id = v_mem.household_id;

    if v_members = 1 then
      delete from households where id = v_mem.household_id;
      if v_result = 'no_household' then
        v_result := 'household_deleted';
      end if;
    else
      insert into audit_events (household_id, user_id, action, target)
      values (v_mem.household_id, auth.uid(), 'member.account_deleted', v_mem.id::text);
      delete from household_members where id = v_mem.id;
      v_result := 'left_household';
    end if;
  end loop;

  return v_result;
end;
$$;

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
