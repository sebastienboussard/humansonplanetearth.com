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
      but that was traced to the browser, not the site: Firefox's own built-in
      viewer renders the same file blank, with no site code involved. The file
      itself was verified well-formed — embedded `/FontFile2` subset font, a
      59 KB content stream with 1319 text-show operators. Not a site bug; see
      §4 for the failure-mode work it did surface.

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
- [ ] Detect the empty-render case and fall back to the browser's native PDF
      view (`<object>`/`<iframe>` on the same public URL), keeping react-pdf as
      the enhanced path
- [ ] Surface the existing Download link more prominently when the fallback
      triggers — it already works and needs no canvas
- [ ] Consider capping `devicePixelRatio` on `<Page>`; oversized canvases are a
      common paint-failure trigger. (No help on hardened Firefox, which already
      forces it to 1, but cheap insurance on HiDPI displays.)

## 5. Profiles & Notifications — go-live

Code-complete and verified: 155 tests across 18 suites on `integration`,
`tsc --noEmit` clean, production build clean. What it does and how it keeps
authorship private is in the CHANGELOG (Unreleased) and the README
("Profiles & Notifications", including manual setup steps).

Nice-to-have before merge:
- [ ] Direct unit tests for `lib/notifications.ts` and `lib/email.ts` — both
      sit at 0% coverage because every route suite mocks them (all other new
      code is 90–100%). Worth covering: claim-then-send dedupe via
      `notification_log`, self-notification skip, pref filtering, the
      `__long-form__` sentinel URL handling, and batch chunking at 100.

Manual steps, only Seb can do these:
- [ ] Run the new sections of `supabase/schema.sql` in the Supabase SQL editor
- [ ] Supabase dashboard → Authentication: enable magic-link email sign-in,
      add `https://<site>/auth/confirm` to redirect URLs, set the Site URL
- [ ] Resend: verify the sending domain (DNS) for `NOTIFY_FROM_EMAIL`
- [ ] Vercel: set `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`,
      `NOTIFY_FROM_EMAIL`, `UNSUBSCRIBE_SECRET`, `CRON_SECRET`
      (cron schedule already lives in `vercel.json`)

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

- [ ] Use it as the public contact address instead of any personal address
- [ ] Use it as the `from`/reply-to for outbound notification email
- [ ] Add it to the privacy page as the route for takedown or correction
      requests on published papers

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
- **Profiles & notifications** — code-complete, pending the manual steps in §5
- **Stale `netlify.toml` removed** — the site runs on Vercel
- **Branch consolidation** — everything collected onto `integration`
- **PDF viewer SSR outage** — fixed, regression-tested, shipped to production
  and verified against the live domain (§1)
- **Papers confirmed rendering on the live site** in Brave/Chromium. A blank
  render on one hardened Firefox profile was traced to the browser, not the
  site — Firefox's own viewer renders the same file blank. The file was
  verified well-formed byte-for-byte.

## Ruled out while chasing the blank-render report (2026-07-28)

Recorded so none of these get re-investigated:
- PDF file corruption — valid xref, embedded `/FontFile2`, 1319 text-show ops
- Supabase storage / CORS — 200, `application/pdf`, `access-control-allow-origin: *`
- pdf.js worker asset — emitted and correctly referenced at `/_next/static/media/`
- react-pdf ↔ pdfjs-dist version mismatch — both pinned to 5.4.296
- Text/annotation layer CSS — contains no blend modes or opacity tricks
- Firefox fingerprinting protection — disabling it changed nothing
- GPU compositing — Firefox's own viewer paints white, not a transparent hole
