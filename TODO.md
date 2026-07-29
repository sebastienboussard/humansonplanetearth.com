# To-Do

## Profiles & Notifications (branch: `profiles-and-notifications`)

Feature is code-complete and verified: 133 tests pass across 16 suites,
`tsc --noEmit` clean, production build clean. What it does and how it keeps
authorship private is in the CHANGELOG (2026-07-28) and the README
("Profiles & Notifications" section, including the manual setup steps).

Remaining before merge (nice-to-have):
- [ ] Direct unit tests for `lib/notifications.ts` and `lib/email.ts` — both
      sit at 0% coverage because every route suite mocks them (all other new
      code is 90–100%). Worth covering: claim-then-send dedupe via
      `notification_log`, self-notification skip, pref filtering, the
      `__long-form__` sentinel URL handling, and batch chunking at 100.

Go-live checklist (manual, only Seb can do these):
- [ ] Run the new sections of `supabase/schema.sql` in the Supabase SQL editor
- [ ] Supabase dashboard → Authentication: enable magic-link email sign-in,
      add `https://<site>/auth/confirm` to redirect URLs, set the Site URL
- [ ] Resend: verify the sending domain (DNS) for `NOTIFY_FROM_EMAIL`
- [ ] Vercel: set `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`,
      `NOTIFY_FROM_EMAIL`, `UNSUBSCRIBE_SECRET`, `CRON_SECRET`
      (cron schedule already lives in `vercel.json`)

## Security & Privacy Fixes

### 1. PDF Metadata Stripping
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
5. Add the same two vars in Netlify → Site settings → Environment variables
6. Run: `npm install @marsidev/react-turnstile`

**Code changes (after env vars are set):**
- [ ] `app/submit/SubmitForm.tsx` — add `<Turnstile>` widget, gate submit button on token
- [ ] `app/api/submit/route.ts` — verify `cf-token` against Cloudflare siteverify API (only when `TURNSTILE_SECRET_KEY` is present)
