-- A page in a Reading Room no longer needs a title (TODO §21). Seb's call,
-- 2026-10-27: the writing is what matters, and a title is one more thing to
-- think of before you can send it. The body is still required.
--
-- A title, when given, still has to be real text of at most 200 characters,
-- so a page can have no title but never a blank one. The route stores an
-- empty title as null.
--
-- Safe to run twice (README "Migrations and deploys").

alter table room_pages alter column title drop not null;
alter table room_pages drop constraint if exists room_pages_title_check;
alter table room_pages add constraint room_pages_title_check
  check (title is null or char_length(btrim(title)) between 1 and 200);
