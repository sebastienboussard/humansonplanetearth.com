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

## Profiles & Notifications

Accounts are optional and anonymous (magic-link sign-in via Supabase Auth; email
only, no username). They exist for email notifications — new words, deadline
reminders, comments on your papers, replies to your comments — each an opt-out
preference with a signed one-click unsubscribe link in every email. Signed-in
users can attach submissions to their profile as a private log of their own
papers — the attachment is internal only and has no public surface.

Manual setup:

1. Run the new sections of `supabase/schema.sql` in the Supabase SQL editor.
2. Supabase dashboard → Authentication: enable email (magic link) sign-in and
   add `https://<site>/auth/confirm` to the redirect URLs; set the Site URL.
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
