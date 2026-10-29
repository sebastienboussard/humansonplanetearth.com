-- Change requests on papers (TODO §24). Seb's call, 2026-10-28: an author whose
-- paper is attached to their account can send a replacement PDF; the admin
-- reviews it and applies it. Authors never edit a paper directly, and only the
-- PDF can change for now.
--
-- No profile column, on purpose. The route checks ownership through
-- paper_authors when the request is made, and finds the author again the same
-- way, so the admin side stays author-free like `papers` (DECISIONS.md).
-- RLS on with zero policies, like the *_authors tables: service role only.
--
-- Safe to run twice (README "Migrations and deploys").

create table if not exists paper_edit_requests (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers(id) on delete cascade,
  pdf_path text not null,
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'applied', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table paper_edit_requests enable row level security;

-- One open request per paper. Enforced here rather than only in the route, so
-- two requests racing each other cannot both land: the second insert fails.
create unique index if not exists paper_edit_requests_one_pending
  on paper_edit_requests (paper_id) where status = 'pending';

create index if not exists paper_edit_requests_paper_idx
  on paper_edit_requests (paper_id, created_at desc);

-- Applying is one call, all or nothing: the paper points at the new file and
-- the request is marked applied in the same transaction. Returns the old path
-- so the route can remove that file afterwards — row first, then the file, the
-- order the review route already uses. Raises, and changes nothing, if the
-- request is not pending or the paper was rejected.
create or replace function apply_paper_edit(p_request uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  req paper_edit_requests%rowtype;
  old_path text;
  paper_status text;
begin
  select * into req from paper_edit_requests where id = p_request for update;
  if not found then
    raise exception 'change request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'change request is not pending';
  end if;

  select pdf_url, status into old_path, paper_status
    from papers where id = req.paper_id for update;
  if not found or paper_status = 'rejected' then
    raise exception 'paper is not open to changes';
  end if;

  update papers set pdf_url = req.pdf_path where id = req.paper_id;
  update paper_edit_requests set status = 'applied', decided_at = now() where id = p_request;

  return old_path;
end;
$$;

-- Service role only, as with request_room() in 0006.
revoke all on function apply_paper_edit(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function apply_paper_edit(uuid) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function apply_paper_edit(uuid) from authenticated;
  end if;
end;
$$;
