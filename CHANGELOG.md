# Changelog

All notable changes to this project are documented here.

## Unreleased

### Security
- **Upload rate limiting.** `/api/submit` and `/api/submit/long-form` accepted
  unlimited scripted uploads. Both are now capped per IP per hour (5 word
  papers, 3 long-form) using a shared Postgres counter, so the limit holds
  across serverless instances — a module-level counter cannot work on Vercel,
  where cold starts reset state and concurrent requests land on separate
  instances. The whole hit is a single atomic upsert. If the store is
  unreachable the limiter fails **open** and logs: it sits behind the real
  validation, and a database blip must not close submissions.
- **Admin sessions are no longer a constant.** The session cookie was
  `HMAC(ADMIN_PASSWORD, "hope-admin-session")` — the same value on every device
  in every session forever, with no expiry, so one leaked cookie stayed valid
  until the password was rotated. Tokens now carry a random per-session nonce
  and a signed issue time, and expire after 7 days. Tokens minted by the old
  scheme are rejected. The derivation had been copy-pasted into five files and
  now lives in `lib/admin-auth.ts`.
- **Admin login is rate-limited** — 8 attempts per 15 minutes per IP — and the
  password compare is constant-time.
- **Rejected papers' PDFs are deleted.** Rejecting a paper only updated the row;
  the file stayed in the bucket, downloadable by anyone who guessed the path.
  Both the reject and delete paths now update the database first and remove the
  file second, so a failed removal leaves a stray file rather than a live row
  pointing at nothing. `scripts/cleanup-rejected-pdfs.ts` clears the backlog
  (dry run by default).
- **Stored PDF filenames use `crypto.randomUUID()`** instead of `Date.now()`,
  which collided under concurrent uploads and leaked submission times to anyone
  who could read a storage path.

### Changed
- Long-form uploads are capped at **4 MB**, down from 10 MB. Vercel refuses a
  serverless request body above ~4.5 MB before the handler runs, so the old
  limit was never enforceable — a genuine 10 MB upload died at the platform
  boundary with a generic error instead of ours. Oversized requests are now
  refused on `content-length` before the body is buffered.
- The account page's Email Notifications panel collapses, and remembers whether
  you left it open. Seven checkboxes had pushed everything else below the fold;
  the heading now summarises state ("3 of 4 on") when closed.

### Database
- `rate_limits` plus the atomic `rate_limit_hit()` and `prune_rate_limits()`
  functions — `supabase/migrations/0003_rate_limits.sql`. **Must be applied
  before this ships.** Until it is, the limiters fail open and every upload is
  allowed, exactly as today.

## 2026-08-19

Released to production. Profiles & notifications shipped later the same day —
the hold-back was reverted once the Supabase tables and magic-link auth were
confirmed in place.

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
