# Changelog

All notable changes to this project are documented here.

## Unreleased

Built and tested, not yet on `main`. (User profiles & email notifications are
also complete but are held back on the `integration` branch for a later
release; this list covers everything else.)

### Added
- **Invisible hashtags.** Authors can optionally tag a paper when they submit
  it. Tags are never displayed anywhere on the site — they exist only to power
  a filter box on word pages and the long-form index, so a reader can narrow
  the list by theme without the pages gaining visible clutter. Tags are
  normalized server-side (lowercased, `#` stripped, restricted to letters,
  digits, hyphens and underscores, max 10 tags of 30 characters) and stored in
  a new `papers.tags` column.
- **Admin page rework.** `/admin/review` is now tabbed — Messages / Pending
  papers / Published papers / Words — with unread and pending count badges,
  and the active tab synced to the URL hash so reloads and email deep links
  land on the right tab. The published tab gained a word/title search box and
  sorts newest-first; the words tab lists existing words above the add form.
  One shared client context owns all four datasets, so approving a paper
  moves it to the published list immediately (previously it silently never
  appeared there until a hard reload).
- **Admin email alerts.** New paper submissions (both routes) and contact
  messages email `ADMIN_NOTIFY_EMAIL` through Resend. Unset var = silent
  no-op. Alerts carry no tags, storage paths or ids.
- Test coverage: unit tests for the tag helpers, route tests asserting
  hashtags are normalized server-side rather than trusted from the client,
  suites for the contact email-first path, admin alerts, the admin queue
  moves, and the Resend wrapper (`lib/email.ts` — batch chunking at 100,
  failure handling).

### Fixed
- **The contact form no longer loses messages.** The route now emails the
  admin inbox *before* inserting into the database, and returns success if
  the email got through even when the insert fails — the `messages` table is
  currently missing in production, and every message sent through `/contact`
  was silently lost.
- Approved papers now appear in the admin published history immediately (see
  the admin rework above).

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
- Hyperlinks embedded in submitted PDFs are clickable again. The viewer rendered
  every page with the annotation layer switched off, and that layer is what draws
  the link elements over the canvas — so there were no links to click. Text
  selection was disabled for the same reason and is also restored. External links
  now open in a new tab rather than navigating away from the paper.
- `vitest` was added to `package.json` without regenerating the lockfile,
  which would have failed the production build at `npm ci`. Caught before it
  reached `main`.
- **Word and paper pages no longer return 500.** `components/PdfViewer.tsx`
  imports react-pdf at module top level, and pdf.js references `DOMMatrix` — a
  browser-only global — while it evaluates. `"use client"` does not stop Next
  from server-rendering a component for the initial HTML, so every page
  embedding the viewer threw `ReferenceError: DOMMatrix is not defined` in Node
  before its route handler ever ran. The homepage was unaffected, which made the
  site look healthy at a glance. The viewer is now loaded through a client
  wrapper (`components/PdfViewerClient.tsx`) with `dynamic(..., { ssr: false })`,
  so pdf.js only ever evaluates in the browser. Covered by
  `tests/ssr/pdf-viewer-ssr.test.ts`, which evaluates each page module in a Node
  environment and fails with the original error if the static import returns.
  Shipped to production and verified against the live domain: word pages, both
  paper routes and the long-form index all return 200, and papers render.

### Removed
- `netlify.toml`. The site deploys on Vercel; this was a leftover from an
  earlier host and had no effect on builds.

### Security
- Uploaded PDFs are stripped of identifying metadata before they reach storage.
  The Info dictionary (title, author, subject, keywords, producer, creator,
  dates) is cleared and the XMP `/Metadata` stream object is deleted from the
  pdf-lib context, not merely unlinked from the catalog — pdf-lib does not
  garbage-collect, so unlinking alone leaves the data in the file bytes.
  Sanitization fails closed: a PDF that cannot be processed is rejected rather
  than stored unmodified. Visible bylines, comments, and image EXIF are not
  covered and still need human review before publishing.

### Known issues
- **The PDF viewer degrades badly when a canvas cannot paint.** Papers are
  rendered into a `<canvas>` by pdf.js. If a browser fails to paint it — a
  privacy-hardened profile, an unusual GPU path, an extension interfering with
  canvas — the viewer draws nothing, and with no opaque background behind it the
  result is a see-through gap where the paper should be rather than a readable
  fallback. The reader sees a broken-looking page while the site looks healthy
  to everyone else. This is worth taking seriously here specifically: a site
  built for anonymity attracts hardened browsers, and canvas is exactly what
  those setups interfere with. Fix planned — opaque backing plus a fallback to
  the browser's native PDF view. See TODO §4.

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
