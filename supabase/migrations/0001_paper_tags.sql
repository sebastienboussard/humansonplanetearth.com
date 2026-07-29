-- Invisible hashtags: authors tag their papers at submit time. Tags are never
-- displayed; they only power the search-box filter on the word and long-form
-- pages. Run this against the Supabase project once.

alter table papers
  add column if not exists tags text[] not null default '{}';

-- Speeds up any future tag-based server queries (optional but cheap).
create index if not exists papers_tags_idx on papers using gin (tags);
