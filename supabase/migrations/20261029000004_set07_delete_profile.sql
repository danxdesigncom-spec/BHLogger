-- Behavior Logger — M12e SET-07: delete a profile permanently.
-- Admins only. The profile's entries (and their revisions), medications (and their change history),
-- option lists, quick taps, appointments and access rows go with it through the existing ON DELETE
-- CASCADE foreign keys. An audit event records who deleted which profile id; the name isn't kept.

create or replace function delete_profile(p_profile_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_hid uuid;
begin
  select household_id into v_hid from profiles where id = p_profile_id;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  if get_member_role(v_hid) is distinct from 'admin' then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  -- Pending invites that would grant access to this profile simply lose it.
  update invites
  set    profile_ids = array_remove(profile_ids, p_profile_id)
  where  household_id = v_hid
    and  p_profile_id = any (profile_ids);

  delete from profiles where id = p_profile_id;

  insert into audit_events (household_id, user_id, action, target)
  values (v_hid, auth.uid(), 'profile.deleted', p_profile_id::text);
end;
$$;

revoke all on function delete_profile(uuid) from public, anon;
grant execute on function delete_profile(uuid) to authenticated;
