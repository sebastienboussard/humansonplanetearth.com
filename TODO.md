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
