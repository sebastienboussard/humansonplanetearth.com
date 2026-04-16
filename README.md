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
```

3. Start the dev server:

```bash
npm run dev
```

## Supabase Setup

Three tables are required:

- `words` — `id`, `word`, `month`, `year`, `deadline`
- `papers` — `id`, `word_id`, `type`, `title`, `pdf_url`, `email`, `status`, `submitted_at`
- `comments` — `id`, `word_id`, `paper_id`, `parent_comment_id`, `body`, `created_at`

One Storage bucket named `papers` for PDF uploads.

To enable comments on long-form papers, insert a sentinel row into `words`:

```sql
INSERT INTO words (word, month, year, deadline)
VALUES ('__long-form__', 1, 2000, '2000-01-01');
```
