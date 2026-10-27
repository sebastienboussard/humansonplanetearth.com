-- Reading Rooms, an asynchronous book club (TODO §21).
--
-- A signed-in account opens a room around a book or a film and breaks it into
-- sections. Anyone writes pages about a section: moderated, typed and
-- anonymous, published as Human On Planet Earth. Anyone writes margins: short
-- replies under a page, published instantly, one level deep. Seb's call,
-- 2026-10-26: pages and margins need no account; creating a room does.
--
-- Author-free by design. No public table holds who wrote anything. The three
-- *_authors tables keep that link privately, with RLS on and zero policies,
-- the way paper_authors does for papers (DECISIONS.md, "Tripwires").
--
-- Safe to run twice (README "Migrations and deploys").

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (char_length(slug) between 1 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- Who made the *work* (author, director), never who opened the room.
  creator_name text check (char_length(creator_name) <= 200),
  medium text not null check (medium in ('book', 'film', 'series', 'play', 'other')),
  year integer check (year between -3000 and 2100),
  intro text check (char_length(intro) <= 2000),
  -- Open Library identifiers, filled by the lookup in §21b. Validated here as
  -- well as in the route, so no client can plant an arbitrary URL.
  ol_work_key text check (ol_work_key ~ '^/works/OL[0-9]+W$'),
  cover_id integer check (cover_id > 0),
  isbn text check (isbn ~ '^[0-9Xx-]{10,17}$'),
  status text not null default 'live' check (status in ('live', 'removed')),
  created_at timestamptz not null default now()
);

create table if not exists room_sections (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  position integer not null check (position >= 0),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  -- 'whole' is the closing "The whole work" section every room gets.
  kind text not null default 'part' check (kind in ('part', 'whole')),
  unique (room_id, position)
);
create unique index if not exists room_sections_one_whole_idx
  on room_sections (room_id) where kind = 'whole';

create table if not exists room_pages (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references room_sections(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  -- An optional passage the page answers. Capped to stay a quotation.
  quote text check (char_length(quote) <= 300),
  locator text check (char_length(locator) <= 40),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now()
);
create index if not exists room_pages_section_idx on room_pages (section_id, status);

create table if not exists room_margins (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references room_pages(id) on delete cascade,
  parent_id uuid references room_margins(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists room_margins_page_idx on room_margins (page_id, created_at);

-- The private links. RLS on, ZERO policies: only the service role sees them.
create table if not exists room_authors (
  room_id uuid primary key references rooms(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists room_authors_profile_idx on room_authors (profile_id, created_at);

create table if not exists room_page_authors (
  page_id uuid primary key references room_pages(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade
);

create table if not exists room_margin_authors (
  margin_id uuid primary key references room_margins(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade
);

alter table rooms enable row level security;
alter table room_sections enable row level security;
alter table room_pages enable row level security;
alter table room_margins enable row level security;
alter table room_authors enable row level security;
alter table room_page_authors enable row level security;
alter table room_margin_authors enable row level security;

-- Public reads: live rooms, their sections, approved pages in live rooms, and
-- margins on those pages. Writes go through the API with the service role,
-- so there are no insert/update policies at all.
drop policy if exists "public read live rooms" on rooms;
create policy "public read live rooms" on rooms
  for select using (status = 'live');

drop policy if exists "public read sections of live rooms" on room_sections;
create policy "public read sections of live rooms" on room_sections
  for select using (exists (select 1 from rooms r where r.id = room_id and r.status = 'live'));

drop policy if exists "public read approved pages" on room_pages;
create policy "public read approved pages" on room_pages
  for select using (
    status = 'approved'
    and exists (
      select 1 from room_sections s join rooms r on r.id = s.room_id
       where s.id = section_id and r.status = 'live'
    )
  );

drop policy if exists "public read margins on approved pages" on room_margins;
create policy "public read margins on approved pages" on room_margins
  for select using (
    exists (
      select 1 from room_pages p
        join room_sections s on s.id = p.section_id
        join rooms r on r.id = s.room_id
       where p.id = page_id and p.status = 'approved' and r.status = 'live'
    )
  );

-- Creating a room is one call: cap check, room, sections and the private
-- author row, all or nothing. Two separate inserts could leave a room with no
-- recorded creator, which the cap could then never count.
--
-- The cap is 3 rooms per account per rolling 24 hours, counted with an
-- advisory lock per profile so a double-click can't slip a fourth through. It
-- fails CLOSED: this is the boundary. The per-IP limiter in the route sits on
-- top and fails open (lib/rate-limit.ts). Same shape as
-- word_proposals_enforce_cap() in migration 0004.
--
-- p_sections is a JSON array of {label, kind}, already built by
-- lib/rooms.ts buildSections(): parts in order, then the whole work last.
create or replace function create_room(
  p_profile_id uuid,
  p_slug text,
  p_title text,
  p_creator_name text,
  p_medium text,
  p_year integer,
  p_intro text,
  p_sections jsonb
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

  insert into rooms (slug, title, creator_name, medium, year, intro)
  values (p_slug, p_title, p_creator_name, p_medium, p_year, p_intro)
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

-- Only the service role may call it. Without this, the anon key could create
-- rooms directly over PostgREST and skip the route's checks.
revoke all on function create_room(uuid, text, text, text, text, integer, text, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function create_room(uuid, text, text, text, text, integer, text, jsonb) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function create_room(uuid, text, text, text, text, integer, text, jsonb) from authenticated;
  end if;
end;
$$;
