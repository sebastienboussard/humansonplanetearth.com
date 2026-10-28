-- "Where to find it" links on a Reading Room (TODO §21). Seb's call,
-- 2026-10-27: whoever opens or asks for a room can add up to five links to
-- where the work can be read, borrowed, bought or watched. Optional.
--
-- Stored on the room as a JSON array of {"url": "..."}, checked here as well
-- as in the route (lib/rooms.ts parseLinks), so no client can plant a
-- javascript: or data: link that the room page then renders. Only http(s),
-- no whitespace, at most 500 characters each.
--
-- create_room() and request_room() gain a p_links argument. It has a
-- default, so the code still running between this migration and the deploy
-- keeps calling them exactly as before.
--
-- Safe to run twice (README "Migrations and deploys").

create or replace function room_links_valid(links jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(links) = 'array'
     and jsonb_array_length(links) <= 5
     and not exists (
       select 1 from jsonb_array_elements(links) as l
        where jsonb_typeof(l) <> 'object'
           or jsonb_typeof(l->'url') <> 'string'
           or char_length(l->>'url') > 500
           or (l->>'url') !~ '^https?://[^[:space:]]+$'
     );
$$;

alter table rooms add column if not exists links jsonb not null default '[]'::jsonb;
alter table rooms drop constraint if exists rooms_links_check;
alter table rooms add constraint rooms_links_check check (room_links_valid(links));

-- Replace both functions with a p_links version. The old signatures are
-- dropped first, or Postgres would keep both overloads side by side.
drop function if exists create_room(uuid, text, text, text, text, integer, text, jsonb);
drop function if exists request_room(text, text, text, text, integer, text, jsonb, text);

-- As in 0005, plus links.
create or replace function create_room(
  p_profile_id uuid,
  p_slug text,
  p_title text,
  p_creator_name text,
  p_medium text,
  p_year integer,
  p_intro text,
  p_sections jsonb,
  p_links jsonb default '[]'::jsonb
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

  insert into rooms (slug, title, creator_name, medium, year, intro, links)
  values (p_slug, p_title, p_creator_name, p_medium, p_year, p_intro, coalesce(p_links, '[]'::jsonb))
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

-- As in 0006, plus links.
create or replace function request_room(
  p_slug text,
  p_title text,
  p_creator_name text,
  p_medium text,
  p_year integer,
  p_intro text,
  p_sections jsonb,
  p_reply_email text,
  p_links jsonb default '[]'::jsonb
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

  insert into rooms (slug, title, creator_name, medium, year, intro, status, links)
  values (p_slug, p_title, p_creator_name, p_medium, p_year, p_intro, 'requested', coalesce(p_links, '[]'::jsonb))
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

-- Service role only, as before. A new function starts with EXECUTE granted to
-- public, so the revokes are repeated for the new signatures.
revoke all on function create_room(uuid, text, text, text, text, integer, text, jsonb, jsonb) from public;
revoke all on function request_room(text, text, text, text, integer, text, jsonb, text, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function create_room(uuid, text, text, text, text, integer, text, jsonb, jsonb) from anon;
    revoke all on function request_room(text, text, text, text, integer, text, jsonb, text, jsonb) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function create_room(uuid, text, text, text, text, integer, text, jsonb, jsonb) from authenticated;
    revoke all on function request_room(text, text, text, text, integer, text, jsonb, text, jsonb) from authenticated;
  end if;
end;
$$;
