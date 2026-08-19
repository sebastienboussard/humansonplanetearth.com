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

## ⏸ 2. The papers bucket is public — DEFERRED

**Deliberately parked 2026-08-19.** Seb's call: the bucket stays public for now.
Recorded rather than closed, because §7's cleanup script and the reject-deletes-
PDF change both assume a guessable path is readable — that assumption is what
makes deleting rejected files worth doing at all.

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

## ✅ 3. Upload endpoints have no rate limit and no auth — DONE

`/api/submit` and `/api/submit/long-form` accepted unlimited scripted uploads —
storage cost, quota burn, flooded review queue.

- [x] Both upload routes rate-limited through a shared Supabase store
      (`supabase/migrations/0003_rate_limits.sql`, `lib/rate-limit.ts`). The
      whole hit is one `insert ... on conflict do update`, so it is atomic under
      concurrency — no read-modify-write race where two simultaneous requests
      both read 4 and both write 5. Word papers 5/hour/IP, long-form 3/hour/IP.
      **Fails open** if the store is unreachable: the limiter sits behind the
      real checks, and a database blip must not close submissions. Contrast §9,
      where the check *is* the boundary and must fail closed
- [x] `app/api/submit/long-form/route.ts` — `MAX_SIZE` lowered 10 MB → 4 MB, under
      Vercel's ~4.5 MB serverless body cap, so the limit is one we can actually
      enforce. Added a `content-length` pre-check that refuses oversized bodies
      with 413 before `req.formData()` buffers them. Form copy updated to match
- [ ] Threat model: Vercel request logs likely record submitter IPs alongside
      submissions. PDF scrubbing doesn't cover what the platform logs — write
      this down on the privacy page or fix it. **Now sharper:** the rate limiter
      derives an IP from `x-forwarded-for` on every upload. It is never stored
      (only a key like `submit:<ip>` with a counter, expiring within the hour),
      but the privacy page should say so plainly rather than leave it implicit

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

## ✅ 5. Profiles & Notifications — LIVE

Shipped to `main` on 2026-08-18 by reverting the carve-out commit `df1166c`
(`caac5a2`), plus two follow-ups: `b3a35c7` (`/api/account/me` returns every
notification pref) and `37eac38` (`/auth/confirm` accepts PKCE codes). What it
does and how it keeps authorship private is in the CHANGELOG and the README.

Every manual step is now verified — checked directly against production on
2026-08-19:

- [x] All five profiles tables present
- [x] Supabase email sign-in enabled (`/auth/v1/settings` reports `email: true`)
- [x] Resend sending domain verified; a real send returned HTTP 200
- [x] `supabase/migrations/0002_deadline_reminder_windows.sql` **is applied** —
      all three `deadline_14d` / `deadline_7d` / `deadline_1d` columns return
      200 with the migration's defaults. This was recorded here as the one true
      blocker; it had already been run
- [x] Site URL and redirect allow-list. This *was* wrong: `{{ .SiteURL }}` was
      still `http://localhost:3000`, so every emailed link pointed at localhost
- [x] `UNSUBSCRIBE_SECRET` and `CRON_SECRET` present in Vercel. Confirmed by
      probe rather than by dashboard: `Bearer undefined` to the cron route
      returns 401 (it would return 200 if the var were unset), and an
      unsubscribe signature forged with the `"unset"` fallback key is rejected

**Magic-link templates — resolved 2026-08-19.** The Supabase email templates had
been overridden to the `{{ .TokenHash }}` form, which cannot work here:
`@supabase/ssr` hard-codes `flowType: "pkce"` (`createBrowserClient.js:40`,
spread *after* the caller's options, so it is not overridable), so
`signInWithOtp` sends a `code_challenge` and the emailed token comes back
`pkce_`-prefixed. `verifyOtp` never sends a code verifier, so it cannot redeem
one. The fix is `{{ .ConfirmationURL }}` in both the Confirm signup and Magic
Link templates — Supabase's own verify endpoint converts the PKCE token to a
`?code=`, which `exchangeCodeForSession` handles.

Consequence worth recording: **there is no cross-device magic link available**
while `@supabase/ssr` forces PKCE. The link only works in the browser that
requested it, because the verifier lives in that browser's cookie. The comment
in `app/auth/confirm/route.ts` claiming the `token_hash` form "works across
devices" was wrong and has been corrected.

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

## ✅ 7. Upload paths + delete on reject — DONE

- [x] `app/api/submit/route.ts` — `crypto.randomUUID()` instead of `Date.now()`
      in the filename. Timestamps collide under concurrent uploads and leak
      submission times to anyone who can read a storage path
- [x] `app/api/submit/long-form/route.ts` — same
- [x] `app/api/admin/review/route.ts` — `PATCH` to `rejected` now removes the
      storage object. It reads `pdf_url` before the update, since afterwards the
      row survives but the file should not
- [x] Both paths ordered update-row-first, then best-effort remove — including
      the existing `DELETE` handler, which had them the other way round. A stray
      file beats a live row pointing at a missing one. Removal failures are
      logged, never fatal: the database is the record of what is published
- [ ] One-time cleanup: papers already rejected still have their PDFs in storage.
      `scripts/cleanup-rejected-pdfs.mjs` does it — **dry run by default**, pass
      `--apply` to delete. A dry run on 2026-08-19 found exactly **3** orphaned
      files, all with old `Date.now()` names. Not deleted yet; needs Seb

## ✅ 8. Admin auth — DONE

- [x] `getSessionToken()` was `HMAC(ADMIN_PASSWORD, "hope-admin-session")` — a
      constant, with no expiry, duplicated across five files. Replaced by
      `lib/admin-auth.ts`, one module: tokens are
      `<issuedAt>.<random nonce>.<hmac>`, so every login yields a different
      cookie and a leaked one dies after 7 days. `issuedAt` is inside the signed
      payload, so a holder cannot extend it without breaking the HMAC. Rotating
      `ADMIN_PASSWORD` still invalidates everything. Stateless by choice — a
      sessions table would allow revoking one device, at the cost of a database
      round trip on every admin request; with a single admin, password rotation
      is the revoke button. Old constant tokens are rejected (regression-tested)
- [x] Login route rate-limited via the shared store from §3 — 8 attempts per
      15 minutes per IP, keyed off `x-forwarded-for` / `x-real-ip` because
      `NextRequest.ip` is unset on Vercel
- [x] `crypto.timingSafeEqual` for the password compare, both sides SHA-256'd
      first so the buffers match length regardless of what was submitted
      (`timingSafeEqual` throws on a length mismatch, and the throw itself would
      leak the expected length). Smallest of the three by real-world impact —
      network jitter dwarfs the delta — but cheap and correct

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
