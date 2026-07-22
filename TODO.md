# To-Do

## Security & Privacy Fixes

### 1. PDF Metadata Stripping
Strip Author, Creator, Producer, Title, Subject, Keywords from every uploaded PDF before it hits storage. pdf-lib is already a dependency — strip fields on the loaded `pdfDoc` and re-serialize before uploading.

- [ ] `app/api/submit/route.ts` — strip metadata after page count check, upload sanitized buffer
- [ ] `app/api/submit/long-form/route.ts` — strip metadata after validation, upload sanitized buffer

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
5. Add the same two vars in Netlify → Site settings → Environment variables
6. Run: `npm install @marsidev/react-turnstile`

**Code changes (after env vars are set):**
- [ ] `app/submit/SubmitForm.tsx` — add `<Turnstile>` widget, gate submit button on token
- [ ] `app/api/submit/route.ts` — verify `cf-token` against Cloudflare siteverify API (only when `TURNSTILE_SECRET_KEY` is present)

---

## Doubt's Notes (2026-07-21)

Checked every item against the code. Nothing above is wrong, but several fixes treat symptoms and the list misses the biggest problems.

### The bucket is public — item 2's premise is broken

`supabase/schema.sql:54-61` creates the bucket `public=false` and says PDFs are served via signed URLs. False. No `createSignedUrl` exists anywhere — all serving uses `getPublicUrl` (`app/api/admin/review/route.ts:37`, `app/words/[word]/page.tsx:35`, `app/long-form/[paperId]/page.tsx:33`). The deployed site renders PDFs, so the bucket was flipped to public in the dashboard. RLS on the `papers` table does nothing for storage objects: anyone who guesses a path can download `pending` and `rejected` PDFs today. `crypto.randomUUID()` is obscurity, not access control.

- [ ] Decide: (a) public bucket, UUIDs as obscurity-only, or (b) private bucket + `createSignedUrl` with short TTL
- [ ] Fix the wrong comment in `supabase/schema.sql`

### Item 1: pdf-lib doesn't strip what matters most

`setAuthor/setTitle/...` only touch the Info dictionary. Survives a re-save:

- **XMP metadata stream** (`Catalog → /Metadata`) — where Acrobat/Word/LaTeX write author and toolchain. Must delete explicitly: `pdfDoc.catalog.delete(PDFName.of('Metadata'))`
- Embedded attachments, document JS, annotations
- Visible content — a name in the byline. Metadata stripping does nothing about it

One thing it does fix that the item doesn't claim: the full rewrite flattens incremental-save revision history.

- [ ] Add explicit XMP removal in both routes
- [ ] UI copy: "we strip file metadata but cannot remove your name if it's written in the document"

### Item 2: delete-on-reject works, but

`pdf_url` is a storage path, not a full URL, so `storage.remove([pdf_url])` works as written (`admin/review/route.ts:61` already does it).

- [ ] Already-rejected papers are still publicly downloadable — needs a one-time cleanup
- [ ] Update the DB row first, then best-effort remove. A stray file beats a live row pointing at a missing one

### Item 3: priorities inverted

- The in-memory rate limiter cannot work on Netlify. Lambda: cold starts reset module state, concurrent requests hit separate instances, each counts "attempt 1 of 5". `NextRequest.ip` is also empty on Netlify — need `x-nf-client-connection-ip`. As specified it protects nothing
- `timingSafeEqual` is cosmetic. Network jitter dwarfs the compare delta. Do it last
- Not listed: `getSessionToken()` is `HMAC(ADMIN_PASSWORD, "hope-admin-session")` — a constant. Every admin session forever has the same cookie value. If it leaks, it's valid until the password rotates

- [ ] Random per-session token (server-side) or signed JWT with `exp` — before any timing-safe compare
- [ ] Rate limiting in a shared store (Supabase table with atomic upsert, or Upstash), aimed at the upload endpoints first (see below)

### Item 4: wrong scope, fails open

- [ ] Turnstile covers the 2 MB word endpoint; the 10 MB long-form endpoint gets nothing. Add it to `app/long-form/submit/LongFormSubmitForm.tsx` + its route
- [ ] "Only when `TURNSTILE_SECRET_KEY` is present" fails open — a typo'd env var silently disables verification. In production, absent secret = reject
- [ ] Pass `remoteip` to siteverify

### Not on the list at all

- [ ] `/api/submit` and `/api/submit/long-form` have no rate limit and no auth — the actual DoS surface. Unlimited scripted uploads: storage cost, quota, flooded review queue
- [ ] The 10 MB long-form limit exceeds Netlify's ~6 MB function body cap. `req.formData()` buffers the whole request before the size check at `long-form/route.ts:24` runs, so a real 10 MB upload 500s at the platform boundary. Lower the limit (~4 MB effective) or use direct-to-Supabase signed upload URLs
- [ ] Netlify request logs likely record submitter IPs next to submissions. PDF scrubbing doesn't cover what the server logs. Belongs in the threat model
- Checked, low risk: CSRF (`sameSite=lax` blocks cross-site PATCH/DELETE), SSRF (no user-supplied URLs fetched), content-type spoofing (`PDFDocument.load` is the real gate)

### Order of attack

1. Resolve the public bucket — everything else hangs on it
2. Rate-limit the upload endpoints; fix the long-form size cap
3. XMP removal + honest UI copy
4. Delete ordering + one-time orphan cleanup
5. Turnstile on long-form, fail-closed
6. Per-session token, then `timingSafeEqual` if still worth it
