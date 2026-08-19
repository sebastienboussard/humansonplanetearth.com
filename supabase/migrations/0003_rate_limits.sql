-- Shared rate-limit store.
--
-- This has to live in the database. A module-level counter cannot work on
-- Vercel: cold starts reset module state, and concurrent requests land on
-- separate lambda instances that each count "attempt 1 of 5".
--
-- The whole hit is one INSERT ... ON CONFLICT DO UPDATE so it is atomic under
-- concurrency — no read-modify-write race where two simultaneous requests both
-- read count=4 and both write count=5.

create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

-- Only the service role touches this table; deny everything else.
alter table rate_limits enable row level security;

-- Records one hit against `p_key` and reports whether it is allowed.
-- The window is a fixed window: once `p_window_seconds` have passed since
-- window_start, the counter resets to 1 and a new window opens.
create or replace function rate_limit_hit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns table (allowed boolean, hits integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_start timestamptz;
begin
  insert into rate_limits as r (key, count, window_start)
    values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else r.count + 1
        end,
        window_start = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else r.window_start
        end
  returning r.count, r.window_start into v_count, v_start;

  allowed := v_count <= p_max;
  hits := v_count;
  retry_after := greatest(
    0,
    ceil(extract(epoch from (v_start + make_interval(secs => p_window_seconds) - now())))
  )::integer;
  return next;
end;
$$;

-- Housekeeping: rows for keys nobody hits again would accumulate forever.
-- Call this occasionally (or wire it to a cron) — nothing depends on it running.
create or replace function prune_rate_limits(p_older_than_seconds integer default 86400)
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from rate_limits
    where window_start < now() - make_interval(secs => p_older_than_seconds)
    returning 1
  )
  select count(*)::integer from deleted;
$$;
