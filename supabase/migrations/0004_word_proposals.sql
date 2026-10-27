-- A word queue that accounts can add to (TODO §20).
--
-- Words are admin-only today: nothing in the schema carries a status, a
-- position or an idea of "next". This adds proposals. The queue order is
-- *derived at read time* (lib/word-queue.ts): a word's round is its position
-- among its own author's waiting words, oldest first, and the queue sorts by
-- round then age. So everyone's first waiting word is considered before
-- anyone's second. There is deliberately no stored ordinal: nothing to assign
-- under a race, nothing to renumber when a row leaves.
--
-- Safe to run twice (README "Migrations and deploys"): every statement is
-- `if not exists`, `create or replace`, or dropped first.

create table if not exists word_proposals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  -- Same rule as isValidWord() in lib/word-format.ts: 2-24 characters, a-z
  -- with internal ' or -, a letter at each end. Checked in the route first;
  -- this is the floor if a route ever forgets.
  word text not null
    check (char_length(word) between 2 and 24 and word ~ '^[a-z][a-z''-]*[a-z]$'),
  status text not null default 'waiting'
    check (status in ('waiting', 'used', 'declined')),
  used_word_id uuid references words(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists word_proposals_queue_idx on word_proposals (status, created_at);
create index if not exists word_proposals_profile_idx on word_proposals (profile_id);

-- Two people cannot have the same word waiting at once. Partial, so a declined
-- word can be proposed again, and a used one is governed by words.word's
-- UNIQUE.
create unique index if not exists word_proposals_waiting_word_idx
  on word_proposals (word) where status = 'waiting';

-- RLS on, ZERO policies, like profiles. Only the service role, through the API
-- routes, ever reads or writes this table. The admin queue is served without
-- proposer identity, and this table is never joined to papers, which stays
-- author-free (DECISIONS.md, "Tripwires").
alter table word_proposals enable row level security;

-- At most three waiting words per account. Not expressible as a UNIQUE, and a
-- read-then-write count in the route loses to a double-click. The advisory lock
-- serialises inserts for one profile, so the count is exact.
--
-- Fails CLOSED: this *is* the cap, not mitigation sitting behind one. Contrast
-- the per-IP limiter on the same route, which may fail open (lib/rate-limit.ts).
-- The route maps this error to a 409.
create or replace function word_proposals_enforce_cap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  waiting_count integer;
begin
  if new.status <> 'waiting' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('word_proposals:' || new.profile_id::text));

  -- A fresh statement after the lock, so under READ COMMITTED it sees any
  -- insert that committed while this one waited.
  select count(*) into waiting_count
    from word_proposals
   where profile_id = new.profile_id
     and status = 'waiting';

  if waiting_count >= 3 then
    raise exception 'word_proposal_cap' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists word_proposals_cap on word_proposals;
create trigger word_proposals_cap
  before insert on word_proposals
  for each row execute function word_proposals_enforce_cap();
