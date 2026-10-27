# Humans on Planet Earth

A platform built around monthly word prompts. Each month a single word is chosen — anyone can submit a one-page PDF response, written, drawn, or anything else, published anonymously as *Human On Planet Earth*. There is also a long-form section for work of any length, any form, any topic, at any time.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
SUPABASE_SECRET_KEY=
ADMIN_PASSWORD=

# Profiles & email notifications
NEXT_PUBLIC_SITE_URL=          # absolute base URL used in emails, e.g. https://humansonplanetearth.com
RESEND_API_KEY=                # Resend API key for notification emails
NOTIFY_FROM_EMAIL=             # e.g. HOPE <notify@humansonplanetearth.com>
UNSUBSCRIBE_SECRET=            # long random string signing one-click unsubscribe links
CRON_SECRET=                   # Vercel Cron bearer token for /api/cron/deadline-reminders
ADMIN_NOTIFY_EMAIL=            # where admin alerts go (new papers, contact messages); unset = alerts off
```

   Everything above is required except `NEXT_PUBLIC_SITE_URL`,
   `NOTIFY_FROM_EMAIL` and `ADMIN_NOTIFY_EMAIL`. If a required variable is
   missing, the server refuses to start and lists each one in the log. The
   check is in `lib/env.ts`.

3. Start the dev server:

```bash
npm run dev
```

## Supabase Setup

Tables (full definitions in `supabase/schema.sql`):

- `words` — `id`, `word`, `month`, `year`, `deadline`
- `papers` — `id`, `word_id`, `type`, `title`, `pdf_url`, `status`, `submitted_at`
- `comments` — `id`, `word_id`, `paper_id`, `parent_comment_id`, `body`, `created_at`
- `profiles`, `notification_prefs`, `paper_authors`, `comment_authors`,
  `notification_log` — optional anonymous accounts and email notifications.
  These have RLS enabled with **zero policies** on purpose: they are invisible
  to the anon key and only reachable through API routes using the service key.

One Storage bucket named `papers` for PDF uploads.

### Migrations and deploys

Every schema change after `schema.sql` is a numbered file in
`supabase/migrations/`. **Production is never changed by hand any more.** A push
to `main` runs `.github/workflows/deploy.yml`, which does three things in
order:

1. Checks the code: lint, typecheck and tests.
2. Applies any pending migrations with `supabase db push`.
3. Triggers the Vercel production deploy through a deploy hook.

If a step fails, the steps after it don't run, so new code never goes live
against an old database. Vercel's own auto-deploy of `main` is switched off in
`vercel.json` for this reason.

Write every migration so it can run twice without harm: `if not exists`,
`create or replace`, and `drop policy if exists` before `create policy`. A
rerun should never be what breaks a deploy.

**One-time setup** (`TODO.md` §1a tracks whether it is done):

1. GitHub → repository → Settings → Secrets and variables → Actions. Add:
   - `SUPABASE_DB_URL`: from Supabase → Connect, the **Session pooler**
     string (port 5432), with the database password in place of
     `[YOUR-PASSWORD]`.
   - `VERCEL_DEPLOY_HOOK_URL`: from Vercel → Settings → Git → Deploy Hooks.
     Create one for branch `main`.
2. Record the migrations that were applied by hand, so `db push` doesn't
   replay them. Replaying would be harmless, since all three are safe to
   rerun, but the history should be true:
   ```bash
   npx supabase@2.122.0 migration repair --db-url "<same string>" --status applied 0001 0002 0003
   npx supabase@2.122.0 migration list --db-url "<same string>"
   ```
3. Push `main`, then watch the run under the repository's **Actions** tab.

Setting up from scratch: run `schema.sql`, then the migrations in order. That
file is known to differ from production in places. The papers bucket is one
(`TODO.md` §2), and §1a carries replacing it with a baseline dumped from the
live database.

## Profiles & Notifications

Accounts are optional and anonymous (magic-link sign-in via Supabase Auth; email
only, no username). They exist for email notifications — new words, deadline
reminders, comments on your papers, replies to your comments — each an opt-out
preference with a signed one-click unsubscribe link in every email. Signed-in
users can attach submissions to their profile as a private log of their own
papers — the attachment is internal only and has no public surface.

Manual setup:

1. Create the tables. See "Migrations and deploys" above.
2. Supabase dashboard → Authentication: enable email (magic link) sign-in and
   add `https://<site>/auth/confirm` to the redirect URLs; set the Site URL.
   Both the **Magic Link** and **Confirm signup** templates must carry
   **both** `{{ .ConfirmationURL }}` (the link) and `{{ .Token }}` (the code).
   Never swap the link for `{{ .TokenHash }}`: that broke every sign-in once.
   The link only works in the browser that asked for it, while the code
   works on any device. **Email OTP Length must be 8**, matching
   `OTP_LENGTH` in `lib/sign-in-code.ts`.
3. Resend: verify the sending domain (DNS records) for `NOTIFY_FROM_EMAIL`.
4. Vercel: set the env vars above. `vercel.json` schedules
   `/api/cron/deadline-reminders` daily at 09:00 UTC (sends at exactly 7 and
   1 days before the deadline; the `notification_log` table makes reruns safe).

Note: the site deploys on Vercel and the cron config lives in `vercel.json`.

To enable comments on long-form papers, insert a sentinel row into `words`:

```sql
INSERT INTO words (word, month, year, deadline)
VALUES ('__long-form__', 1, 2000, '2000-01-01');
```
