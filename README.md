# Humans on Planet Earth

A writing platform built around monthly word prompts. Each month a single word is chosen — anyone can submit a one-page PDF response, published anonymously as *Human On Planet Earth*. There is also a long-form section for writing of any length, any topic, at any time.

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

# Email (admin alerts, sent through Resend)
NEXT_PUBLIC_SITE_URL=          # absolute base URL used in emails, e.g. https://humansonplanetearth.com
RESEND_API_KEY=                # Resend API key
NOTIFY_FROM_EMAIL=             # e.g. HOPE <notify@humansonplanetearth.com>
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

One Storage bucket named `papers` for PDF uploads.

Admin email alerts need Resend: verify the sending domain (DNS records) for
`NOTIFY_FROM_EMAIL`, then set the env vars above in Vercel. The site deploys
on Vercel.

To enable comments on long-form papers, insert a sentinel row into `words`:

```sql
INSERT INTO words (word, month, year, deadline)
VALUES ('__long-form__', 1, 2000, '2000-01-01');
```
