# Testing framework

Self-contained quality gate for everything submitted to the site. All test
code lives in this directory; nothing here ships to production.

## Running

```bash
npm test            # run the full suite once
npm run test:watch  # re-run on file change while developing
```

No environment variables or network access needed — `setup.ts` installs fake
credentials and every Supabase call is mocked, so the suite can never touch
the real database or storage.

## Layout

```
tests/
├── setup.ts              # global env setup (runs before every suite)
├── helpers/
│   ├── supabase-mock.ts  # chainable Supabase client mock + module mock
│   ├── auth-mock.ts      # user-session + profile module mocks (holder pattern)
│   ├── pdf.ts            # real PDF fixtures built with pdf-lib
│   ├── request.ts        # NextRequest builders (JSON / FormData / GET)
│   └── admin.ts          # admin session-cookie helpers
├── lib/                  # unit tests for lib/ functions
│   ├── words.test.ts
│   ├── tags.test.ts              # hashtag parsing / normalisation
│   ├── unsubscribe.test.ts       # signed unsubscribe tokens round-trip/forgery
│   └── email-templates.test.ts   # every template carries its unsubscribe link
└── api/                  # one suite per API route
    ├── submit.test.ts            # word-paper submissions (1 page, 2 MB, PDF-only)
    ├── submit-long-form.test.ts  # long-form submissions (10 MB, valid PDF)
    ├── comments.test.ts          # comment length, trimming, honeypot, authorship
    ├── admin-auth.test.ts        # login / logout, session cookie
    ├── admin-review.test.ts      # approve / reject / delete, auth on every verb
    ├── admin-words.test.ts       # word creation validation + new-word fan-out
    ├── admin-attach.test.ts      # manual paper→profile attachment
    ├── account-me.test.ts        # lazy profile creation, no user_id leakage
    ├── account-prefs.test.ts     # notification preference validation
    ├── account-papers.test.ts    # paper visibility, ownership guard
    ├── account-delete.test.ts    # account deletion by session uid
    ├── unsubscribe.test.ts       # one-click unsubscribe, forged-signature rejection
    └── cron-deadline.test.ts     # cron auth, 7/1-day windows
```

## What the suite guards

- **Submission quality gates** — file type, size limits (2 MB word / 10 MB
  long-form), one-page limit for word papers, PDF parseability, required
  fields, whitespace trimming.
- **Spam defenses** — honeypot fields are silently discarded and never reach
  the database.
- **Admin security** — every admin verb 401s without a valid HMAC session
  cookie; forged cookies are rejected.
- **Data integrity** — inserts carry the exact expected payload (status
  `pending`, correct type, normalized word/title).

## Writing a new test

1. Put it under `tests/lib/` (pure functions) or `tests/api/` (routes),
   named `*.test.ts` — vitest picks it up automatically.
2. If the code touches Supabase, copy this boilerplate to the top of the file
   (vitest hoists `vi.mock`, so the holder must come from `vi.hoisted`):

   ```ts
   const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
   vi.mock("@/lib/supabase", async () =>
     (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
   );
   ```

3. In each test, install a fresh mock with the results your code expects:

   ```ts
   holder.current = createMockSupabase({
     tables: {
       words: { data: { id: "w1" } },          // one result, first .from("words")
       papers: [{ data: null }, { data: null }], // FIFO queue, one per .from("papers")
     },
     storage: { uploadError: { message: "boom" } }, // optional failure injection
   });
   ```

4. Assert on what the route *did*, not just the status code:
   `holder.current.query("papers")!.insert` is a spy, and
   `holder.current.bucket("papers")!.upload` records storage calls.

**Convention: every new API route gets a suite covering (a) each validation
rejection, (b) each backend-failure path, and (c) one happy path asserting
the exact insert payload.** New sibling projects should copy this directory
wholesale — the helpers have no dependency on this site beyond `@/lib/supabase`.

## Coverage (optional)

Install the provider once, then run with `--coverage`:

```bash
npm i -D @vitest/coverage-v8
npx vitest run --coverage
```
