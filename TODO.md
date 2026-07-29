# To-Do

## 🔴 LIVE OUTAGE — word pages return 500

Every page that renders the PDF viewer is down in production. The homepage is
fine, so the site looks healthy at a glance.

`components/PdfViewer.tsx` imports `react-pdf` at module top level. `"use client"`
does not stop Next from server-rendering a component for the initial HTML, so
pdf.js evaluates in Node — where `DOMMatrix` doesn't exist — and the request
throws `ReferenceError: DOMMatrix is not defined`.

Introduced by `8e8eecb` ("Enable text/annotation layers in PdfViewer"), not by
anything in the current branches. Reproduced identically on `main`, on the
pre-push commit `31ddfbc`, and against the live domain.

- [ ] `components/PaperCarousel.tsx` — load the viewer client-only:
      `const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false })`
- [ ] `app/words/[word]/[paperId]/page.tsx` — same treatment (it's a server
      component, so the viewer needs a client wrapper)
- [ ] `app/long-form/[paperId]/page.tsx` — check it for the same import path
- [ ] Add a test that server-renders a word page and asserts 200, so this class
      of SSR crash can't reach production again

## Done

- **PDF metadata stripping** — see §1 below, both routes shipped.
- **Testing framework** — vitest suite on `main`, 71 tests, `npm test`.
- **Invisible hashtags** — built and tested on `worktree-invisible-hashtags`;
  the Supabase migration has been applied to production, so the branch is
  deployable once the outage above is fixed.
- **Stale `netlify.toml` removed** — the site runs on Vercel.

## Security & Privacy Fixes
Strip Author, Creator, Producer, Title, Subject, Keywords from every uploaded PDF before it hits storage. pdf-lib is already a dependency — strip fields on the loaded `pdfDoc` and re-serialize before uploading.

- [x] `app/api/submit/route.ts` — strip metadata after page count check, upload sanitized buffer
- [x] `app/api/submit/long-form/route.ts` — strip metadata after validation, upload sanitized buffer
- Note: also deletes the XMP `/Metadata` stream object from the pdf-lib context (not just the catalog key — pdf-lib doesn't GC, so the naive delete leaves the name in the file bytes). Verified with a byte-scan test. Visible bylines/comments/image EXIF still need human review before publishing.

### 2. Enumerable Upload Paths + Delete on Reject
- [ ] `app/api/submit/route.ts` — replace `Date.now()` with `crypto.randomUUID()` in filename
- [ ] `app/api/submit/long-form/route.ts` — replace `Date.now()` with `crypto.randomUUID()` in filename
- [ ] `app/api/admin/review/route.ts` — on PATCH to `rejected`, fetch paper's `pdf_url` and call `storage.remove([pdf_url])` before updating the DB row

### 3. Admin Login Hardening
- [ ] `app/api/admin/login/route.ts` — replace `password !== ADMIN_PASSWORD` with `crypto.timingSafeEqual` (hash both to SHA-256 first so lengths always match)
- [ ] `app/api/admin/login/route.ts` — add module-level in-memory rate limiter: 5 attempts / 15 min per IP, return 429 when exceeded

### 4. Cloudflare Turnstile (spam protection on word submit)

**External setup required first:**
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile → Add widget
2. Choose "Managed" mode, add `humansonplanetearth.com` as hostname
3. Copy the **Site Key** and **Secret Key**
4. Add to `.env.local`:
   ```
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key
   TURNSTILE_SECRET_KEY=your_secret_key
   ```
5. Add the same two vars in Vercel → Project settings → Environment variables
6. Run: `npm install @marsidev/react-turnstile`

**Code changes (after env vars are set):**
- [ ] `app/submit/SubmitForm.tsx` — add `<Turnstile>` widget, gate submit button on token
- [ ] `app/api/submit/route.ts` — verify `cf-token` against Cloudflare siteverify API (only when `TURNSTILE_SECRET_KEY` is present)

## Features

### "What's Changed" tab
A page where readers can see what's new on the site — not a dev changelog, but
a human-readable "here's what changed since you last visited."

`CHANGELOG.md` already exists with dated entries and Added/Changed/Removed
sections, so the page can render that rather than maintaining a second list.

- [ ] `app/changes/page.tsx` — new route, linked from `components/Nav.tsx`
- [ ] Decide the source: parse `CHANGELOG.md` at build time, or move entries
      into a `changes` table so non-code updates (new word of the month, new
      papers published) can appear without a deploy
- [ ] Keep the entries reader-facing — "you can now filter papers by hashtag",
      not "refactored PaperCarousel"
- [ ] Optional: a subtle "new" marker in the nav when there are entries newer
      than the visitor's last visit (localStorage timestamp, no account needed)

## Site email

The site now has its own address: **weare.HumansOnPlanetEarth@gmail.com**

- [ ] Use it as the public contact address on the contact page instead of any
      personal address
- [ ] Use it as the `from`/reply-to for outbound notification email
- [ ] Add it to the privacy page as the route for takedown or correction
      requests on published papers
