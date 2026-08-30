# Decisions

What `CHANGELOG.md` cannot hold. The changelog says what shipped and when;
`TODO.md` says what still needs doing. This file says what was **ruled out**,
what was **retracted**, what was **corrected**, and what was **proved against
production** — the reasoning that would otherwise be re-derived, or worse,
re-investigated.

Three rules, inherited from `TODO.md`:

- **Nothing here is rewritten to match the present.** Every entry keeps its
  original date and its original claim. A wrong call stays on file with a
  correction beside it, because that is what stops it being made twice.
- **Cite by content, not line number.** Line numbers rot silently; a quoted
  phrase or a function name survives a reformat.
- **Promote before you close.** A ruled-out option, a measurement, or a decision
  that will matter in six months lands here before the job it came from closes —
  not in a plan sheet, which is scratch and gets deleted.

---

## Tripwires — each one already paid for

The six facts that have each cost something. Kept in the repo rather than only
in a working file, so they survive a machine.

- **Migrations are manual and nothing enforces them.** Six tables the code used
  did not exist in production for months; every contact-form message sent in
  that window was lost. `TODO.md` §1a. Still open, and the single most likely
  way to break production again.
- **`@supabase/ssr` hard-codes `flowType: "pkce"`** and spreads it *after* the
  caller's options, so it cannot be overridden. Two consequences:
  `{{ .TokenHash }}` email templates cannot work (use `{{ .ConfirmationURL }}`),
  and magic links only work in the browser that requested them, because the
  verifier lives in that browser's cookie. `app/auth/confirm/route.ts`.
- **`papers` is deliberately author-free.** It carries a public SELECT policy,
  so an author column there would be readable with the anon key. Ownership lives
  in the private `paper_authors` table instead. `supabase/schema.sql`.
- **The storage bucket is public in production** despite `public=false` in the
  schema, so pending and rejected PDFs are readable by anyone who guesses a
  path. `TODO.md` §2, deferred deliberately.
- **`rateLimit` fails open by design.** It sits behind the real checks, and a
  database blip must not close submissions. `lib/rate-limit.ts` explains in a
  comment when that is right and when it is not — the distinction is the point,
  not the default.
- **`getAdminClient()` returns `any`.** There are no generated database types.
  This is how 13 lint errors hid, and how a real nullability mismatch hid behind
  them. Name the row shape; do not annotate a callback `any` to quiet the
  compiler.

---

## Retracted and corrected

Newest first. Each keeps the original claim, not just the fix.

### 2026-08-30 — the former host's name, kept then removed

`CLAUDE.md` and `TODO.md` both recorded that the old host's name in
`CHANGELOG.md` and `doubt-log.md` was **deliberately left**, as a dated record
of what was true then. Reversed the same day: the host was used for two days at
the very start of the project, it appears nowhere in the code, and a name that
shows up only in docs invites the question of whether it is still involved.

The name is gone from the prose in `CHANGELOG.md`, `TODO.md` and the entry
folded in below. Each record kept its substance — what was cleaned up and why.
What still carries the name is the `archive/remove-netlify-config` tag, which
names a live ref on `origin`; rewording it would mean retagging and trading a
working recovery path for a naming preference.

The general rule survives the exception: **do not rewrite a dated record to
match the present.** The *subject* of a record is the author's call; the
substance is not.

### 2026-08-29 — the open-work list said nine sections; ten were open

`TODO.md`'s header omitted §7, which had carried a 🟠 and an open item since it
was reopened for the upload→insert race. Added rather than quietly fixed.

### 2026-08-19 — `token_hash` does not work across devices

A comment in `app/auth/confirm/route.ts` claimed the `token_hash` form of the
magic link "works across devices". It does not, and cannot, while
`@supabase/ssr` forces PKCE — see the tripwire above. The comment was corrected.

Worth stating plainly because it shaped a later design: **there is no
cross-device magic link available** on the current stack. `TODO.md` §14 records
the one experiment that would change that.

### 2026-07-28 — "blank" was actually "transparent", and GPU compositing is back in scope

The failed PDF render on one hardened Firefox profile was first recorded as
**blank/white**. On re-checking it is **transparent** — a see-through hole, the
same as the site embed shows.

That single word had been carrying the entire diagnosis. GPU compositing had
been *ruled out* on the reasoning that "Firefox's own viewer paints white, not a
transparent hole" — i.e. that the two failures looked different and therefore
had different causes. The premise was a mis-observation, so:

- **GPU compositing moves out of "ruled out" and becomes the leading
  hypothesis.**
- The distinction is sharp, and verifiable in the pinned source: pdf.js fills
  the whole canvas opaque white *before* executing any page content —
  `beginDrawing()` does `fillStyle = background || "#ffffff"; fillRect(...)` as
  its first act, and `executeOperatorList` runs only after. So **white** means
  rendering started and drew nothing (a content or font problem), while
  **transparent** means rendering never started at all — no canvas, or a canvas
  that never reached the compositor. Much narrower, and it points away from the
  file and toward the graphics stack.
- The conclusion **"not a site bug" still holds**, and is in fact stronger: the
  failure reproduces with zero site code, in Firefox's own privileged viewer, on
  the raw storage URL.

Open follow-ups are in `TODO.md` §4a.

---

## Ruled out

Recorded so none of these is investigated a second time.

### The blank-render report (2026-07-28)

- **PDF file corruption** — valid xref, embedded `/FontFile2` subset font, a
  59 KB content stream with 1319 text-show operators. The file is well-formed
  byte-for-byte.
- **Supabase storage / CORS** — 200, `application/pdf`,
  `access-control-allow-origin: *`.
- **pdf.js worker asset** — emitted and correctly referenced at
  `/_next/static/media/`.
- **react-pdf ↔ pdfjs-dist version mismatch** — both pinned to 5.4.296.
- **Text/annotation layer CSS** — contains no blend modes or opacity tricks.
- **Firefox fingerprinting protection** — disabling it changed nothing. Note
  this covers Firefox's built-in `resistFingerprinting` **only**, not
  canvas-blocking extensions like CanvasBlocker or NoScript, which stub out
  `getContext("2d")` by a different mechanism and were never tested.
- ~~**GPU compositing** — Firefox's own viewer paints white, not a transparent
  hole~~ — **RETRACTED**, see above. Now the leading hypothesis.

### Security surface (Doubt's review, re-confirmed 2026-07-28)

- **CSRF** — `sameSite=lax` blocks cross-site PATCH/DELETE.
- **SSRF** — no user-supplied URLs are fetched.
- **Content-type spoofing** — `PDFDocument.load` is the real gate, not the MIME
  check. A file that is not a PDF fails to parse regardless of what it claims.

### Rejected fixes

- **An `<object>`/`<iframe>` fallback to the browser's native PDF view** cannot
  be the primary fallback for the transparent-render case. Firefox's native
  viewer *is* pdf.js on a canvas, and it fails identically on the affected
  profile — the fallback would swap one transparent hole for another. Still
  worth having for the general case. The **Download link** is the only path
  verified to work where canvas paint fails, so it is promoted instead
  (`TODO.md` §4).
- **An in-memory `lru-cache` rate-limit fallback**, proposed by the external
  review as the fix for `rateLimit` failing open. Weaker here than it sounds: on
  Vercel each serverless instance has its own memory and concurrent requests
  land on different instances, so a per-instance counter bounds almost nothing.
  The fix that holds is an edge KV store with no fail-open path (`TODO.md` §3).

### External review claims that were wrong (2026-08-29)

An outside review of the repo. Its useful points were filed into `TODO.md` §1a,
§3, §7 and §11; its already-done points needed no entry. Two headline claims
were wrong:

- *"`next: 16.2.2` is likely a typo for `14.2.2` and will break `npm ci`."*
  No — it is the real pinned version, matched by `eslint-config-next@16.2.2`.
  `npm run build`, `tsc --noEmit` and the full test suite all pass on it.
- *"long-form is capped at 4 MB; lower it to 3.5 MB for multipart overhead."*
  Stale. Both routes have shared one `MAX_UPLOAD_SIZE` of 4.5 MB from
  `lib/upload-limits.ts` since 2026-08-20. The overhead risk it describes is
  real and `TODO.md` §3 already records it, along with the mitigation
  (`submitFailureMessage` turns the platform's non-JSON 413 into a size message)
  and the fallback if it bites — drop the one constant to ~4.3 MB.

Its sharpest correct observation was the one already known and least acted on:
manual database migrations caused the §1a outage, and nothing has changed to
stop that recurring.

---

## Verified against production

The method matters as much as the result — it is the part that gets reused.

### 2026-08-19 — the orphaned-PDF sweep found nothing, and that is the finding

36 stored PDFs against 39 paths referenced by rows. The gap of 3 is exactly the
rejected papers whose files were removed in the earlier cleanup, and
`scripts/cleanup-rejected-pdfs.mjs` independently reports those same 3 as
already gone. **Two scripts written from opposite directions agree** — one walks
rows and asks storage, the other walks storage and asks rows — which is stronger
evidence than either alone.

The first dry run also earned its keep immediately by catching a bug in the
sweeper itself: Supabase leaves a `.emptyFolderPlaceholder` object in every
folder, which has no paper row by definition and was reported as an orphan. The
sweep now only considers `.pdf` files.

### 2026-08-19 — rate limiting proved through the path the app uses

Migration 0003 verified by three calls against a cap of 2 through PostgREST:
allowed / allowed / denied. Not by reading the migration file, and not through a
different client than the app uses.

Separately confirmed live for the admin-login path — an `admin-login:<ip>` row
with a running counter appeared in `rate_limits` after a post-deploy sign-in, so
the shared store, the `x-forwarded-for` IP derivation and the atomic upsert are
all working. The **upload** path is still unexercised; `TODO.md` §3 carries the
smoke test.

### 2026-08-19 — secrets proved by probe, not by dashboard

`UNSUBSCRIBE_SECRET` and `CRON_SECRET` confirmed present in Vercel without
reading the dashboard: `Bearer undefined` to the cron route returns 401, which
it would not if the var were unset, and an unsubscribe signature forged with the
`"unset"` fallback key is rejected. A probe tests the running deployment; a
dashboard tests what someone typed into a form.

Migration 0002 (`deadline_14d` / `deadline_7d` / `deadline_1d`) was recorded as
the one true blocker and turned out to be **already applied** — all three
columns return 200 with the migration's defaults. Checking beat assuming, in
both directions.

One thing that *was* wrong: `{{ .SiteURL }}` was still `http://localhost:3000`,
so every emailed link pointed at localhost.

### 2026-08-29 — closed unanswerable: did any contact messages actually get lost?

Whether messages were sent during the §1a outage window can no longer be
established. The only trace would have been Supabase request logs, and retention
is 1 day on free / 7 days on Pro — the window shut well before anyone checked.

Recorded as unanswerable rather than left open, because the real evidence stands
on its own: the `messages` table held **only** the two test rows afterwards, so
nothing was ever stored.

---

## 2026-07-22 — PDF metadata stripping (adversarial review)

Folded in from `doubt-log.md`, which this file replaces. Two review passes over
the metadata-stripping plan and the routes it changed
(`app/api/submit/route.ts`, `app/api/submit/long-form/route.ts`). The goal:
strip identifying metadata from anonymous PDF submissions before storage.

**Strongest counter-argument, pass 1.** pdf-lib's `setAuthor`/`setTitle`/etc.
clear only the Info dictionary. The XMP metadata stream — `/Metadata` on the
catalog, where Word, LaTeX and Acrobat put `dc:creator` — survives untouched, so
a real author name would still leak. The original verification (a pdf-lib
`getAuthor()` check against an Info-dict-only test PDF) was *structurally
incapable* of catching this.

**Strongest counter-argument, pass 2.** `catalog.delete(PDFName.of("Metadata"))`
removes only the *reference*. pdf-lib does not garbage-collect on `save()` — it
writes every object in the context — so the XMP stream persists as an orphaned
object with the name still in the raw bytes. Worse, `exiftool` follows the
reference and reports "clean", making verification a **false PASS**.

The fix, now shipped: also `pdfDoc.context.delete(metaRef)`, and verify with a
raw byte scan rather than exiftool alone.

**Open questions — still live.** These are gaps in the current strip, not
history; `TODO.md` §6 carries the actionable half.

- A **visible byline** in the document body or header is the most common
  deanonymization vector, and no metadata scrub touches it. Human review, or an
  explicit warning to the submitter, is still required before publishing.
- Custom (non-standard) Info-dictionary keys and Word custom document properties
  are not cleared by the six standard setters — residual leak.
- Page-level and image-XObject `/Metadata`, EXIF inside embedded images, and
  annotation `/T` author tags all survive the re-save.
- `save()` defaults to `updateFieldAppearances: true`, which can silently alter
  form rendering — `false` is recommended. Post-save size can also exceed the
  pre-check limit, so the limit is re-checked after the rewrite.
- The plan justified avoiding `exiftool`/`qpdf` by claiming a hosting
  constraint. Unverified; the conclusion holds either way, but the rationale was
  never checked.
