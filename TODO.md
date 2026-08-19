# To-Do

Single merged list. Sources folded in: the working list, the outage notes from
`todo-whats-changed`, Doubt's 2026-07-21 review, and the profiles/notifications
checklist. Doubt's review predated the Vercel move and the metadata work — its
Netlify references and its XMP item have been corrected against current code
(verified 2026-07-28), not copied over as written.

All feature branches are now collected on `integration`.

---

## ✅ 1. LIVE OUTAGE — word pages return 500 — FIXED AND LIVE

`components/PdfViewer.tsx` imports `react-pdf` at module top level. `"use client"`
does not stop Next from server-rendering a component for the initial HTML, so
pdf.js evaluated in Node — where `DOMMatrix` doesn't exist — and the request
threw `ReferenceError: DOMMatrix is not defined`. The homepage was unaffected,
so the site looked healthy at a glance.

Introduced by `8e8eecb` ("Enable text/annotation layers in PdfViewer").
Reproduced locally against a production build: `/words/audacity`,
`/words/communicate` and `/words/connect` all returned 500 before the fix and
200 after.

- [x] `components/PdfViewerClient.tsx` — new `"use client"` wrapper that loads
      the viewer with `dynamic(() => import("./PdfViewer"), { ssr: false })`.
      One wrapper rather than three call-site fixes, because `ssr: false` is
      only legal inside a client component and two of the three call sites are
      server components.
- [x] `components/PaperCarousel.tsx`, `app/words/[word]/[paperId]/page.tsx`,
      `app/long-form/[paperId]/page.tsx` — all import the wrapper
- [x] `tests/ssr/pdf-viewer-ssr.test.ts` — regression guard. Evaluates each page
      module in the Node test environment (the context that lacks `DOMMatrix`)
      and asserts no throw, plus a structural check that nothing outside the
      wrapper imports `PdfViewer` directly. Verified to fail with the original
      `ReferenceError` when the fix is reverted.
- [x] **Confirmed in a browser (2026-07-28)** — papers render on the live site
      in Brave/Chromium. They did *not* render in one hardened Firefox profile,
      with no site code involved: opening the raw PDF URL in its own tab, in
      Firefox's built-in viewer, fails there too. The file itself was verified
      well-formed — embedded `/FontFile2` subset font, a 59 KB content stream
      with 1319 text-show operators. Not a site bug; see §4 for the
      failure-mode work it did surface, and §4a for what's still open.
- **Correction (2026-07-28, later)** — the separate-tab render was first
      recorded as *blank/white*. On re-checking it is **transparent**, the same
      see-through hole the site embed shows. That single word was carrying a
      lot of weight; see §4a.

## ✅ 1a. LIVE BUG — the contact form has never delivered a message — FIXED AND LIVE

Found 2026-07-29 while previewing `integration` on localhost against the live
database. Six of the nine tables the code touches **do not exist in production**:

| Present in prod | Missing from prod |
| --- | --- |
| `words`, `papers` (incl. `tags`), `comments` | `messages`, `profiles`, `notification_prefs`, `notification_log`, `paper_authors`, `comment_authors` |

`supabase/schema.sql` defines all nine. Only the first three were ever applied;
the schema grew with each feature and was never re-run. The repo has one
migration file, `0001_paper_tags.sql`, covering the `tags` column and nothing
else.

`messages` is the urgent one, because it is used by code on `main` — the
deployed branch. `app/api/contact/route.ts:37` inserts into `messages`, gets
`PGRST205: Could not find the table 'public.messages' in the schema cache`, and
returns 500 "Submission failed. Please try again." Every message anyone has
sent through `/contact` on the live site was lost. The admin inbox at
`/api/admin/messages` reads the same missing table.

Not verified by submitting a live message — the table's absence and the insert
are both confirmed directly, which is enough.

**Resolved 2026-08-19.** All nine tables now exist in production, and the
email-first contact route shipped to `main` the same day. Verified end to end
against the live database: a submission returns 200, the row lands in
`messages`, and the admin alert email is delivered through Resend (whose
sending domain was verified the same day).

- [x] Create `messages` in production from the `schema.sql` definition
- [x] Email-first ordering shipped, so a future insert failure no longer loses
      the message — the mitigation is live rather than theoretical
- [ ] Check whether any messages were sent during the outage window; they are
      not recoverable from the database, so the only trace would be in
      Supabase request logs. Note the table held **only** the two test rows
      afterwards, confirming nothing was ever stored
- [ ] Decide whether `schema.sql` sections should become numbered migrations,
      so this cannot drift again (see §5, which already lists the profiles
      tables as a manual step — that step is what's missing here too)

## 🔴 2. The papers bucket is public

`supabase/schema.sql:66-67` creates the bucket with `public=false`, and the
comment at `:72-73` claims PDFs are served via signed URLs. Both are false in
practice. No `createSignedUrl` call exists anywhere — every read path uses
`getPublicUrl` (`app/api/admin/review/route.ts:37`, `app/words/[word]/page.tsx:35`,
`app/words/[word]/[paperId]/page.tsx:32`, `app/long-form/[paperId]/page.tsx:35`).
The deployed site renders PDFs, so the bucket was flipped to public in the
dashboard.

RLS on the `papers` table does nothing for storage objects: anyone who guesses a
path can download `pending` and `rejected` PDFs today. This is the premise the
rest of the upload-path work rests on — decide it first.

- [ ] Decide: (a) public bucket, treat UUID filenames as obscurity only, or
      (b) private bucket + `createSignedUrl` with a short TTL on every read path
- [ ] Fix the false comment in `supabase/schema.sql:72-73` either way

## 🔴 3. Upload endpoints have no rate limit and no auth

`/api/submit` and `/api/submit/long-form` accept unlimited scripted uploads —
storage cost, quota burn, flooded review queue. This is the real abuse surface;
admin-login brute force (§8) is the smaller one.

- [ ] Rate-limit both upload routes. Must be a shared store (Supabase table with
      an atomic upsert, or Upstash) — see the note in §8 on why in-memory fails
- [ ] `app/api/submit/long-form/route.ts:6` — `MAX_SIZE` is 10 MB, above Vercel's
      ~4.5 MB serverless request body limit. `req.formData()` buffers the whole
      request before the size check at `:25` runs, so a genuine 10 MB upload dies
      at the platform boundary, not with our error message. Either lower the
      limit to ~4 MB effective, or move to direct-to-Supabase signed upload URLs
- [ ] Threat model: Vercel request logs likely record submitter IPs alongside
      submissions. PDF scrubbing doesn't cover what the platform logs — write
      this down on the privacy page or fix it

## 🟠 4. The PDF viewer fails to a transparent hole

Surfaced while chasing §1. When the canvas fails to paint for any reason, the
viewer renders **nothing** — and because there is no opaque background behind
it, the result is a see-through gap where the paper should be. On one machine
this showed the desktop through the browser window. The site looks broken
rather than the paper.

This matters more here than it would elsewhere. A site built around anonymity
draws visitors on hardened, unusual and privacy-patched browsers — Tor Browser
ships `resistFingerprinting` on by default — and canvas is exactly the surface
those setups interfere with. The failure is silent: the reader sees a blank
page and the site looks fine to everyone else.

- [ ] Opaque background behind the canvas, so a paint failure degrades to a
      blank page instead of a hole
- [ ] ~~Detect the empty-render case and fall back to the browser's native PDF
      view (`<object>`/`<iframe>` on the same public URL)~~ — **this fallback
      does not work on the affected profile.** Firefox's native PDF view *is*
      pdf.js on a canvas, and it fails there in exactly the same way (§4a). An
      `<object>` fallback would swap one transparent hole for another. Still
      worth doing for the general case, but it cannot be the only fallback.
- [ ] **Promote to primary fallback:** the Download link. It needs no canvas,
      it already works, and it is the only path verified to work on a machine
      where canvas paint fails. Surface it prominently whenever the empty-render
      case is detected — not as a secondary nicety.
- [ ] Consider capping `devicePixelRatio` on `<Page>`; oversized canvases are a
      common paint-failure trigger. (No help on hardened Firefox, which already
      forces it to 1, but cheap insurance on HiDPI displays.)

## 🟠 4a. Reopened: what actually fails on the hardened Firefox profile

The 2026-07-28 investigation closed on "not a site bug" and ruled out GPU
compositing. The stated reason was: *Firefox's own viewer paints white, not a
transparent hole* — i.e. the browser's canvas works, the two failures look
different, so they have different causes.

That premise is now retracted. The separate-tab render is **transparent**, not
white. Both paths — our react-pdf embed and Firefox's own built-in viewer —
fail identically, and both are pdf.js drawing to a `<canvas>`.

What this changes:
- **"GPU compositing" moves out of "ruled out" and becomes the leading
  hypothesis.** It was ruled out on the white-vs-transparent distinction alone,
  and that distinction was a mis-observation.
- pdf.js fills the whole canvas opaque white *before* it executes any page
  content. Verified in the pinned source: `beginDrawing()` does
  `fillStyle = background || "#ffffff"; fillRect(0, 0, width, height)` as its
  first act, and `executeOperatorList` only runs after
  (`node_modules/pdfjs-dist/build/pdf.mjs:9831-9861`). So a **white** page means
  "rendering started and drew nothing" — a content/font problem. A
  **transparent** page means **rendering never started at all**: no canvas, or
  a canvas that never reached the compositor. Much narrower, and it points away
  from the file and toward the graphics stack.
- The conclusion "not a site bug" **still holds** and is in fact stronger — the
  failure reproduces with zero site code, in Firefox's privileged viewer, on
  the raw storage URL.

- [ ] **The one test that settles it:** open a completely unrelated PDF from
      some other domain in that same Firefox profile. Transparent too → the
      browser/profile is confirmed, and this file is exonerated for good.
      Renders normally → the file is back in scope and §259's "PDF file
      corruption — ruled out" needs re-opening as well.
- [ ] Check `about:support` → Graphics in that profile: WebRender status,
      compositor, and any listed failure logs. Try toggling
      `gfx.webrender.software` to isolate the compositor.
- [ ] Check for canvas-blocking *extensions* (CanvasBlocker, NoScript). Note
      this was **not** covered by "disabling fingerprinting protection changed
      nothing" (§264) — Firefox's built-in `resistFingerprinting` and an
      extension that stubs out `getContext("2d")` are different mechanisms, and
      only the first one was tested.
- [ ] Whatever the cause, it is out of our control. §4's mitigations are the
      deliverable; this section is only about not re-litigating the diagnosis.

## 5. Profiles & Notifications — go-live

Code-complete and verified: 181 tests across 20 suites on `integration`,
`tsc --noEmit` clean, production build clean. What it does and how it keeps
authorship private is in the CHANGELOG (Unreleased) and the README
("Profiles & Notifications", including manual setup steps).

- [x] Direct unit tests for `lib/notifications.ts` and `lib/email.ts`
      (`tests/lib/notifications.test.ts`, `tests/lib/email.test.ts`) — both
      were at 0% because every route suite mocks them; now 92%/100% line
      coverage. Covers claim-then-send dedupe via `notification_log`,
      self-notification skip, pref filtering, the `__long-form__` sentinel
      URL handling, word vs long-form paper URLs, the 200-char excerpt cap,
      and batch chunking at 100 (including partial-failure counting).

The code ships by reverting the carve-out commit `df1166c` on top of `main`,
which reproduces this tree exactly — no merge from `integration` needed, and
no conflicts. Branch: `release-profiles`.

Manual steps, only Seb can do these. Status verified directly against
production on 2026-08-19:

- [x] Run the profiles sections of `supabase/schema.sql` — all five tables
      (`profiles`, `notification_prefs`, `paper_authors`, `comment_authors`,
      `notification_log`) confirmed present
- [x] Supabase dashboard → Authentication: email sign-in confirmed enabled
      (`/auth/v1/settings` reports `email: true`, signups open)
- [x] Resend: sending domain verified — DKIM, SPF and MX all resolving, and a
      real send returned HTTP 200
- [ ] **Run `supabase/migrations/0002_deadline_reminder_windows.sql`.** Still
      outstanding and now the one true blocker: the tables were created from
      an earlier revision of `schema.sql`, so `notification_prefs` has no
      `deadline_14d` / `deadline_7d` / `deadline_1d` columns. Confirmed by
      querying each column — the three return HTTP 400. Until it runs, saving
      a deadline-window checkbox fails and the cron sends nothing, because
      `subscribers()` filters on columns that do not exist
- [ ] Supabase dashboard → Authentication → URL Configuration: confirm the
      Site URL is set and `https://humansonplanetearth.com/auth/confirm` is in
      the redirect allow-list. Not exposed over the API, so it needs eyes on
      the dashboard; if it is wrong, magic links land somewhere unexpected
- [ ] Vercel: add `UNSUBSCRIBE_SECRET` and `CRON_SECRET`, and confirm the four
      from the 2026-08-19 release are present (`NEXT_PUBLIC_SITE_URL`,
      `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `ADMIN_NOTIFY_EMAIL`) — these are
      not visible from outside the dashboard. A live `/contact` submission
      that produces an alert email proves all four at once
      (cron schedule lives in `vercel.json`, restored by this branch)

## 6. PDF Metadata Stripping — done, with a caveat

- [x] `app/api/submit/route.ts` — strip metadata after page count check
- [x] `app/api/submit/long-form/route.ts` — strip metadata after validation
- [x] XMP `/Metadata` stream deleted from the pdf-lib context, not just
      unlinked from the catalog (pdf-lib doesn't GC, so the naive delete leaves
      the name in the file bytes). Verified with a byte-scan test. This closes
      the gap Doubt flagged.
- [x] The full rewrite also flattens incremental-save revision history.
- [ ] UI copy: "we strip file metadata but cannot remove your name if it's
      written into the document." Visible bylines, comments and image EXIF are
      still not covered and need human review before publishing.
- [ ] Not covered by the current strip: embedded attachments, document-level
      JavaScript, annotations. Decide whether to drop them too.

## 7. Upload paths + delete on reject

- [ ] `app/api/submit/route.ts:91` — replace `Date.now()` with
      `crypto.randomUUID()` in the filename
- [ ] `app/api/submit/long-form/route.ts:75` — same
- [ ] `app/api/admin/review/route.ts` — the `DELETE` handler removes the storage
      object (`:61`), but `PATCH` to `rejected` (`:69-84`) only updates the row.
      Rejected PDFs stay in the bucket and, per §2, stay downloadable.
- [ ] Order it update-row-first, then best-effort remove. A stray file beats a
      live row pointing at a missing one.
- [ ] One-time cleanup: papers already rejected still have their PDFs in storage

## 8. Admin auth

Priorities are inverted from how this was originally written — the session
token is the real hole, `timingSafeEqual` is close to cosmetic.

- [ ] `getSessionToken()` is `HMAC(ADMIN_PASSWORD, "hope-admin-session")` — a
      constant. Every admin session forever carries the same cookie value; if it
      leaks it stays valid until the password rotates. It's also duplicated
      across `app/api/admin/{words,messages,attach,review}/route.ts`. Replace
      with a random per-session token (server-side) or a signed JWT with `exp`,
      in one shared module.
- [ ] Rate-limit the login route via the shared store from §3. A module-level
      in-memory limiter cannot work on Vercel: cold starts reset module state and
      concurrent requests land on separate instances, each counting "attempt 1
      of 5". `NextRequest.ip` is also unset — read `x-forwarded-for` /
      `x-real-ip`.
- [ ] Only then: `crypto.timingSafeEqual` for the password compare (SHA-256 both
      first so lengths match). Network jitter dwarfs the compare delta — do it
      last.

## 9. Cloudflare Turnstile

**External setup required first:**
1. [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile → Add widget
2. "Managed" mode, hostname `humansonplanetearth.com`
3. Copy the **Site Key** and **Secret Key**
4. Add to `.env.local`:
   ```
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key
   TURNSTILE_SECRET_KEY=your_secret_key
   ```
5. Same two vars in Vercel → Project settings → Environment variables
6. `npm install @marsidev/react-turnstile`

**Code changes (after env vars are set):**
- [ ] `app/submit/SubmitForm.tsx` — add `<Turnstile>` widget, gate submit on token
- [ ] `app/api/submit/route.ts` — verify `cf-token` against siteverify
- [ ] `app/long-form/submit/LongFormSubmitForm.tsx` + its route — the original
      plan covered only the 2 MB word endpoint and left the 10 MB long-form one
      unprotected
- [ ] Fail **closed**, not open. "Verify only when `TURNSTILE_SECRET_KEY` is
      present" means a typo'd env var silently disables verification. In
      production an absent secret should reject.
- [ ] Pass `remoteip` to siteverify

## 10. "What's Changed" tab

A page where readers can see what's new — not a dev changelog, but a
human-readable "here's what changed since you last visited."

`CHANGELOG.md` already exists with dated entries and Added/Changed/Removed
sections, so the page can render that rather than maintaining a second list.
The home page now has an expandable "What's new" banner fed by a hardcoded
reader-facing list in `data/whats-new.ts` — that array is the natural seed
content source for this page.

- [ ] `app/changes/page.tsx` — new route, linked from `components/Nav.tsx`
- [ ] Decide the source: parse `CHANGELOG.md` at build time, or move entries
      into a `changes` table so non-code updates (new word of the month, new
      papers published) can appear without a deploy
- [ ] Keep entries reader-facing — "you can now filter papers by hashtag",
      not "refactored PaperCarousel"
- [ ] Optional: a subtle "new" marker in the nav when there are entries newer
      than the visitor's last visit (localStorage timestamp, no account needed)

## 11. Site email

The site now has its own address: **weare.HumansOnPlanetEarth@gmail.com**

- [x] It now receives the admin alerts (§12) via `ADMIN_NOTIFY_EMAIL` — new
      papers and contact messages land in this inbox
- [ ] Use it as the public contact address instead of any personal address
- [ ] Use it as the `from`/reply-to for outbound notification email — note
      Resend can't send *from* a `gmail.com` address; `NOTIFY_FROM_EMAIL`
      stays on the site domain with this address as reply-to
- [ ] Add it to the privacy page as the route for takedown or correction
      requests on published papers

## 12. Admin page — tabs, published history, admin alerts

Done on `integration`, 2026-08-01. Three problems, one shape: `/admin/review`
stacked four sections that each fetched once on mount and owned their data
privately.

**The bug: approved papers never appeared in the published history.** Approve
in `ReviewQueue` only removed the paper from that component's local state;
`PublishedPapers` had fetched once and never refetched, so the approved paper
joined nothing until a hard reload. Even then it was invisible — the published
list was re-sorted *alphabetically by word*, burying each new arrival among the
papers for the same word.

- [x] `lib/admin-queue.ts` — the queue moves as pure functions
      (`movePaperToPublished`, `sortPublished` newest-first, `filterPapers`,
      `unreadCount`), unit-tested since the node-only test env can't test
      components. Mutation-verified: reverting the move logic fails 4 tests
- [x] `app/admin/review/AdminData.tsx` — one client context owns all four
      datasets; pending and published live in a single state object so a paper
      can only leave one list by joining the other. Approve = optimistic move
      + background refetch. All admin reads are `cache: "no-store"`
- [x] Tabs — `AdminDashboard.tsx`: Messages / Pending papers / Published
      papers / Words, with unread and pending count badges, active tab synced
      to `location.hash` so reloads and email deep links land on the right tab
- [x] Published tab gained a search box (word or title); Words tab lists
      existing words (new `GET /api/admin/words`) above the add form
- [x] Admin email alerts — `lib/admin-alerts.ts` emails `ADMIN_NOTIFY_EMAIL`
      on new paper submissions (both routes) and contact messages. Unset var =
      silent no-op. Alerts carry no tags, storage paths or profile ids
- [x] Contact route now emails **before** the insert and returns 200 if the
      email got through even when the insert fails — because of §1a, that
      insert *does* fail in production today, and this at least stops the
      message loss. Mitigation, not the fix; §1a stays open
- [ ] Send a real end-to-end email once Resend DNS is verified (§5) — the
      code path is live but unverified against the real API

---

## Checked, low risk

From Doubt's review, re-confirmed 2026-07-28:
- CSRF — `sameSite=lax` blocks cross-site PATCH/DELETE
- SSRF — no user-supplied URLs are fetched
- Content-type spoofing — `PDFDocument.load` is the real gate, not the MIME check

## Done

- **PDF metadata stripping** — both routes, XMP stream included (§6)
- **Testing framework** — vitest, now 155 tests across 18 suites, `npm test`
- **Invisible hashtags** — migration already applied to production
- **Profiles & notifications** — code-complete, pending the manual steps in §5.
  2026-08-05: the public anonymous author page (`/author/[id]`) and the
  per-paper "show on author page" toggle were removed before release —
  profiles are an internal-only log for now. The `public_visible` column
  stays in `paper_authors` (dormant, default false) in case sharing returns.
- **Stale `netlify.toml` removed** — the site runs on Vercel
- **Branch consolidation** — everything collected onto `integration`
- **PDF viewer SSR outage** — fixed, regression-tested, shipped to production
  and verified against the live domain (§1)
- **Papers confirmed rendering on the live site** in Brave/Chromium. A failed
  render on one hardened Firefox profile was traced to the browser, not the
  site — Firefox's own viewer fails on the same file, with no site code
  involved. The file was verified well-formed byte-for-byte. (Originally
  written as "renders the same file blank"; the render is transparent, not
  blank — see §4a. The not-a-site-bug conclusion is unaffected.)

## Ruled out while chasing the blank-render report (2026-07-28)

Recorded so none of these get re-investigated:
- PDF file corruption — valid xref, embedded `/FontFile2`, 1319 text-show ops
- Supabase storage / CORS — 200, `application/pdf`, `access-control-allow-origin: *`
- pdf.js worker asset — emitted and correctly referenced at `/_next/static/media/`
- react-pdf ↔ pdfjs-dist version mismatch — both pinned to 5.4.296
- Text/annotation layer CSS — contains no blend modes or opacity tricks
- Firefox fingerprinting protection — disabling it changed nothing. Note this
  covers Firefox's built-in `resistFingerprinting` only, *not* canvas-blocking
  extensions (§4a)
- ~~GPU compositing — Firefox's own viewer paints white, not a transparent
  hole~~ — **RETRACTED 2026-07-28.** The premise was wrong: the native viewer
  renders transparent, same as ours. Moved back to open, and it is now the
  leading hypothesis (§4a)
