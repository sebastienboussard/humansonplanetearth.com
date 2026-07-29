# Changelog

All notable changes to this project are documented here.

## Unreleased

Built and tested, not yet on `main`.

### Added
- **Invisible hashtags.** Authors can optionally tag a paper when they submit
  it. Tags are never displayed anywhere on the site — they exist only to power
  a filter box on word pages and the long-form index, so a reader can narrow
  the list by theme without the pages gaining visible clutter. Tags are
  normalized server-side (lowercased, `#` stripped, restricted to letters,
  digits, hyphens and underscores, max 10 tags of 30 characters) and stored in
  a new `papers.tags` column. Lives on `worktree-invisible-hashtags`.
- Test coverage for the above: unit tests for the tag helpers and route tests
  asserting hashtags are normalized server-side rather than trusted from the
  client.

### Database
- `papers.tags text[] not null default '{}'` plus a GIN index
  (`supabase/migrations/0001_paper_tags.sql`). **Already applied to
  production** — it is additive, so current live code is unaffected.

## 2026-07-28

### Added
- **Testing framework.** A vitest suite covering the submit routes (page,
  size and MIME limits, honeypot handling, storage and insert failure paths),
  the admin auth/review/words routes, comments, and the word helpers — 71
  tests. Runs fully offline: fake credentials are injected and every Supabase
  call is mocked, so the suite can never reach the real database. Use
  `npm test`, or `npm run test:watch` while developing.

### Fixed
- `vitest` was added to `package.json` without regenerating the lockfile,
  which would have failed the production build at `npm ci`. Caught before it
  reached `main`.

### Removed
- `netlify.toml`. The site deploys on Vercel; this was a leftover from an
  earlier host and had no effect on builds.

### Known issues
- **Word pages return 500 in production.** `components/PdfViewer.tsx` imports
  `react-pdf` at module top level, and `"use client"` does not prevent Next
  from server-rendering a component for the initial HTML — so pdf.js evaluates
  in Node, where `DOMMatrix` is undefined. The homepage is unaffected, which
  makes the site look healthy at a glance. Introduced earlier by `8e8eecb`
  ("Enable text/annotation layers in PdfViewer") and confirmed on `main`, on
  the preceding commit, and against the live domain. Fix is to load the viewer
  with `dynamic(..., { ssr: false })`. See TODO.

## 2026-06-14

### Removed
- Email collection from submissions. The email field served only as a
  duplicate-prevention key and was never displayed, but storing contributor
  emails undercut the site's anonymity promise. Removed from both submit forms,
  both API routes, and the `papers` schema (column + `one_per_email_per_word`
  index dropped). Spam defense is now the admin review queue plus the honeypot.

### Changed
- Submit pages now show a "Privacy: no account, no email" note in place of the
  former email requirement.
- Replaced the iframe PDF viewer with `react-pdf` for native page-flow rendering.

## Earlier

- Set word of the month to "audacity" for June 2026.
- Fixed submit buttons routing to the wrong word and the deadline gate blocking
  the form.
- Removed the "submissions closed" state — submissions are always open.
