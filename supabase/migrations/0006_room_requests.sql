-- Room requests (TODO §21). Seb's call, 2026-10-27: opening a room still needs
-- an account, but a visitor without one can ask the admin to open it for them.
--
-- A request is an ordinary room row with status 'requested'. Every public
-- policy in migration 0005 reads status = 'live', so a requested room, its
-- sections, and its address are invisible until the admin opens it, and the
-- pages route refuses to write into it. Declining marks it 'declined'; the row
-- stays, like a removed room.
--
-- The requester may leave an email to hear back. It is kept in
-- room_request_contacts, RLS on with zero policies like the *_authors tables,
-- and deleted once the reply is sent.
--
-- Safe to run twice (README "Migrations and deploys").

alter table rooms drop constraint if exists rooms_status_check;
alter table rooms add constraint rooms_status_check
  check (status in ('live', 'removed', 'requested', 'declined'));

create index if not exists rooms_requested_idx on rooms (created_at) where status = 'requested';

create table if not exists room_request_contacts (
  room_id uuid primary key references rooms(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 320),
  created_at timestamptz not null default now()
);
alter table room_request_contacts enable row level security;

-- One call, all or nothing: cap check, room, sections, and the optional
-- contact. Same shape as create_room() in 0005, without an author.
--
-- There is no account to cap, so the cap is on the queue: at most 30 requests
-- waiting at once, under one advisory lock. It fails CLOSED, so a flood stops
-- at a queue the admin can still read. The per-IP limit in the route sits on
-- top and fails open (lib/rate-limit.ts).
create or replace function request_room(
  p_slug text,
  p_title text,
  p_creator_name text,
  p_medium text,
  p_year integer,
  p_intro text,
  p_sections jsonb,
  p_reply_email text
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

  insert into rooms (slug, title, creator_name, medium, year, intro, status)
  values (p_slug, p_title, p_creator_name, p_medium, p_year, p_intro, 'requested')
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

-- Service role only, as with create_room().
revoke all on function request_room(text, text, text, text, integer, text, jsonb, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function request_room(text, text, text, text, integer, text, jsonb, text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function request_room(text, text, text, text, integer, text, jsonb, text) from authenticated;
  end if;
end;
$$;
