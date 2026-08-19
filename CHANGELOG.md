# Changelog

All notable changes to this project are documented here.

## Unreleased

Profiles & notifications. Code-complete and tested; ships once the remaining
Supabase and Vercel setup is done (see TODO §5).

### Added
- Optional anonymous user profiles with email notifications. Passwordless
  magic-link sign-in (Supabase Auth) — email only, no username, no password.
  Four opt-out notification types: new word announced, deadline reminders
  (7 days / 1 day, via a daily Vercel Cron job), comments on your papers, and
  replies to your comments. Every email carries a signed one-click unsubscribe
  link that works without logging in. Emails are sent through Resend.
- Papers can optionally be attached to a profile at submission time (or
  manually by the admin for old papers). Attachments are a private internal
  log with no public surface — only the owner sees the list, on their account
  page. (A public anonymous author page with per-paper sharing was built and
  then taken out before release; the dormant `public_visible` column remains
  in `paper_authors` for a possible future opt-in version.)
- Account page (`/account`) with notification preferences, a private list of
  your attached papers, sign-out, and permanent account deletion (removes the
  email and all profile links; papers stay published anonymously).
- Signed-in commenting silently records authorship in a private table so reply
  notifications work — comments still render anonymously everywhere and the
  comments API never returns author data.
- Test coverage: suites for the account, unsubscribe, attach and cron routes,
  plus direct unit suites for the notification fan-out (`lib/notifications.ts`
  — dedupe, self-notification skip, pref filtering, paper-URL resolution) and
  the Resend wrapper (`lib/email.ts` — batch chunking at 100, failure
  handling). 181 tests across 20 suites.

### Changed
- Profile/paper and profile/comment links live in separate tables
  (`paper_authors`, `comment_authors`) with RLS enabled and zero policies,
  instead of author columns on the publicly readable `papers`/`comments`
  tables — the links are invisible to the anon key by construction.
- Submit-page privacy copy now reads "No account required" (previously
  "No account, no email"), and the privacy page documents optional accounts.
- `/api/admin/words` fans out new-word notification emails after a successful
  insert; notification failures never fail word creation.

### Database
- `profiles`, `notification_prefs`, `paper_authors`, `comment_authors` and
  `notification_log` — the profiles sections of `supabase/schema.sql`.
  **Applied to production 2026-08-19**, but from an earlier revision of the
  file: `notification_prefs` is still missing `deadline_14d`, `deadline_7d`
  and `deadline_1d`. `supabase/migrations/0002_deadline_reminder_windows.sql`
  must be run before this ships, or saving a deadline-window preference fails
  and the reminder cron sends nothing.

## 2026-08-19

Released to production.

### Added
- **Admin dashboard rework.** `/admin/review` is now tabbed — Messages /
  Pending papers / Published papers / Words — with unread and pending count
  badges and the active tab synced to the URL hash, so reloads and email deep
  links land on the right tab. The published tab gained a word/title search
  and sorts newest-first; the words tab lists existing words above the add
  form. One shared client context owns all four datasets.
- **Admin email alerts.** New paper submissions and contact messages email
  `ADMIN_NOTIFY_EMAIL` through Resend. Unset var = silent no-op. Alerts carry
  no tags, storage paths or profile ids.
- **Invisible hashtags.** Authors can optionally tag a paper when they submit
  it. Tags are never displayed anywhere on the site — they exist only to power
  a filter box on word pages and the long-form index. Normalized server-side
  (lowercased, `#` stripped, letters/digits/hyphens/underscores only, max 10
  tags of 30 characters) and stored in `papers.tags`.

### Fixed
- **The contact form no longer loses messages.** The route now emails the
  admin inbox *before* inserting into the database and returns success if the
  email got through even when the insert fails. The `messages` table was
  missing from production entirely, so every message ever sent through
  `/contact` had been silently discarded.
- Approved papers now appear in the admin published history immediately.
  Approving only mutated the review queue's local state, so the published
  list — which fetched once on mount — never learned about it.

### Database
- `papers.tags text[] not null default '{}'` plus a GIN index
  (`supabase/migrations/0001_paper_tags.sql`).
- `messages` created in production from the `supabase/schema.sql` definition.

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
