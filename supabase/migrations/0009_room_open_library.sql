-- The Open Library lookup (TODO §21b). When a book is found on Open Library,
-- the room keeps its work key and cover id, so the room page can show the
-- cover and link to the work. The columns and their checks have been on
-- rooms since 0005 (ol_work_key ~ '^/works/OL[0-9]+W$', cover_id > 0); what
-- was missing is a way to write them, because create_room() and
-- request_room() didn't take them.
--
-- Both gain p_ol_work_key and p_cover_id, defaulting to null, so the code
-- still running between this migration and the deploy keeps calling them as
-- before, exactly as 0008 did for p_links.
--
-- Safe to run twice (README "Migrations and deploys").

drop function if exists create_room(uuid, text, text, text, text, integer, text, jsonb, jsonb);
drop function if exists request_room(text, text, text, text, integer, text, jsonb, text, jsonb);

-- As in 0008, plus the Open Library work and cover.
create or replace function create_room(
  p_profile_id uuid,
  p_slug text,
  p_title text,
  p_creator_name text,
  p_medium text,
  p_year integer,
  p_intro text,
  p_sections jsonb,
  p_links jsonb default '[]'::jsonb,
  p_ol_work_key text default null,
  p_cover_id integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  recent integer;
  new_room uuid;
  section jsonb;
  pos integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('rooms:' || p_profile_id::text));

  select count(*) into recent
    from room_authors
   where profile_id = p_profile_id
     and created_at > now() - interval '24 hours';

  if recent >= 3 then
    raise exception 'room_cap' using errcode = 'check_violation';
  end if;

  if jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) = 0 then
    raise exception 'room_sections_required' using errcode = 'check_violation';
  end if;

  insert into rooms (slug, title, creator_name, medium, year, intro, links, ol_work_key, cover_id)
  values (p_slug, p_title, p_creator_name, p_medium, p_year, p_intro, coalesce(p_links, '[]'::jsonb), p_ol_work_key, p_cover_id)
  returning id into new_room;

  for section in select * from jsonb_array_elements(p_sections) loop
    insert into room_sections (room_id, position, label, kind)
    values (new_room, pos, section->>'label', coalesce(section->>'kind', 'part'));
    pos := pos + 1;
  end loop;

  insert into room_authors (room_id, profile_id) values (new_room, p_profile_id);

  return new_room;
end;
$$;

-- As in 0008, plus the Open Library work and cover.
create or replace function request_room(
  p_slug text,
  p_title text,
  p_creator_name text,
  p_medium text,
  p_year integer,
  p_intro text,
  p_sections jsonb,
  p_reply_email text,
  p_links jsonb default '[]'::jsonb,
  p_ol_work_key text default null,
  p_cover_id integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  waiting integer;
  new_room uuid;
  section jsonb;
  pos integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('rooms:requests'));

  select count(*) into waiting from rooms where status = 'requested';
  if waiting >= 30 then
    raise exception 'room_request_cap' using errcode = 'check_violation';
  end if;

  if jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) = 0 then
    raise exception 'room_sections_required' using errcode = 'check_violation';
  end if;

  insert into rooms (slug, title, creator_name, medium, year, intro, status, links, ol_work_key, cover_id)
  values (p_slug, p_title, p_creator_name, p_medium, p_year, p_intro, 'requested', coalesce(p_links, '[]'::jsonb), p_ol_work_key, p_cover_id)
  returning id into new_room;

  for section in select * from jsonb_array_elements(p_sections) loop
    insert into room_sections (room_id, position, label, kind)
    values (new_room, pos, section->>'label', coalesce(section->>'kind', 'part'));
    pos := pos + 1;
  end loop;

  if p_reply_email is not null then
    insert into room_request_contacts (room_id, email) values (new_room, p_reply_email);
  end if;

  return new_room;
end;
$$;

-- Service role only, as before, repeated for the new signatures.
revoke all on function create_room(uuid, text, text, text, text, integer, text, jsonb, jsonb, text, integer) from public;
revoke all on function request_room(text, text, text, text, integer, text, jsonb, text, jsonb, text, integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function create_room(uuid, text, text, text, text, integer, text, jsonb, jsonb, text, integer) from anon;
    revoke all on function request_room(text, text, text, text, integer, text, jsonb, text, jsonb, text, integer) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function create_room(uuid, text, text, text, text, integer, text, jsonb, jsonb, text, integer) from authenticated;
    revoke all on function request_room(text, text, text, text, integer, text, jsonb, text, jsonb, text, integer) from authenticated;
  end if;
end;
$$;
