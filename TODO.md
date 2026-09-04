# To-Do

**This file is only what still needs doing, and what is half done.** Finished
work is not kept here.

| Looking for | Go to |
| --- | --- |
| What still needs doing | this file |
| What shipped, and when | `CHANGELOG.md` |
| What was ruled out, retracted, corrected, or proved in production | `DECISIONS.md` |
| What a visitor would notice | `data/whats-new.ts` — feeds the home-page banner |
| Setup, env vars, Supabase | `README.md` |

Status markers: `🟠` open · `🟡` partial · `⏸` deferred.

**Section numbers never change.** Eight comments in shipped code, tests and
scripts cite them — `app/api/contact/route.ts` and `tests/api/contact.test.ts`
(§1a), both cleanup scripts (§7, §2), `data/whats-new.ts` (§10),
`lib/rate-limit.ts` (§9), `CHANGELOG.md` (§4). Renumbering breaks all of them
silently; nothing would fail a build. The gaps where §1, §5, §8 and §12 used to
sit are correct — those sections are done, and live in `CHANGELOG.md` and
`DECISIONS.md` now.

New work gets the next free number before `## Housekeeping`.

Last swept 2026-08-30: the lint work committed and pushed (`8dd7024`), the 12
remote branches deleted, and this file split — 812 lines down to open work only,
with the reasoning moved to `DECISIONS.md` rather than deleted.

Added 2026-09-03: §16 (comments — the wrong paper's thread when paging fast, and
no reply to a reply), §17 (no way to find the profile id the attach field wants),
§18 (contact on the About page), §19 (a new word is a dead end until its first
paper lands). All four are Seb's, from reading the live site.

Swept again the same day, after the first wave shipped: §16, §18 and §19 are done
and have left, along with two of §4's four mitigations and two of §11's items.
§17 stays — it is Wave 2. One thing found while ordering the work is **not** here
because it shipped in the same pass: `/api/contact` and `/api/comments` had no
rate limit at all, and now do; it is in `CHANGELOG.md`, its fail-open reasoning
is in `DECISIONS.md`, and §9's scope was widened to cover both routes. The
running order lives in `~/.claude/plans/cheeky-yawning-lighthouse.md` until it is
drained (§15).

---

## 🟠 1a. Migrations are manual, and nothing enforces them

**The most likely way to break production again.** Six tables the code used did
not exist in production for months; every contact-form message sent in that
window was lost, and `/contact` returned 500 the whole time. All nine tables now
exist and the email-first contact route shipped 2026-08-19, so the immediate
damage is closed — but the cause is not.

- [ ] Numbered migrations, *applied automatically*. This was once written as
      "decide whether `schema.sql` sections should become migrations", which
      understates it — the outage was not caused by the schema being one file,
      it was caused by nobody running it. The fix is `supabase db push` (or
      equivalent) in CI on deploy, so prod cannot silently lag the repo. The
      profiles work listed its tables as a manual step; that same manual step is
      what went missing here

## ⏸ 2. The papers bucket is public — DEFERRED

**Deliberately parked 2026-08-19.** Seb's call: the bucket stays public for now.
Recorded rather than closed, because §7's cleanup script and the
reject-deletes-PDF change both assume a guessable path is readable — that
assumption is what makes deleting rejected files worth doing at all.

The schema creates the bucket `public=false` and comments that PDFs are served
via signed URLs. Both are false in practice: no `createSignedUrl` call exists
anywhere, every read path uses `getPublicUrl`, and the deployed site renders
PDFs — so the bucket was flipped to public in the dashboard. RLS on the `papers`
table does nothing for storage objects, so anyone who guesses a path can
download `pending` and `rejected` PDFs today.

- [ ] Decide: (a) public bucket, treat UUID filenames as obscurity only, or
      (b) private bucket + `createSignedUrl` with a short TTL on every read path
- [ ] Fix the false comment in `supabase/schema.sql` — the one claiming PDFs are
      served via signed URLs — either way

## 🟡 3. Upload hardening — shipped, with four open threads

Both upload routes are rate-limited through a shared Postgres store (word papers
5/hour/IP, long-form 3/hour/IP), both share one `MAX_UPLOAD_SIZE` of 4.5 MB from
`lib/upload-limits.ts`, and oversized uploads warn clearly under the dropzone.
`DECISIONS.md` records how the limiter was proved in production.

- [ ] The **upload** path is still unexercised — no `submit:` key has appeared
      yet. Same code and same store as the login path, which is confirmed
      working, so this is confirmation rather than doubt. The smoke test is six
      submissions from one IP; the sixth should return 429 with a `Retry-After`
- [ ] Threat model: Vercel request logs likely record submitter IPs alongside
      submissions. PDF scrubbing doesn't cover what the platform logs — write
      this down on the privacy page or fix it. **Sharper:** the rate limiter
      derives an IP from `x-forwarded-for` on every upload. It is never stored
      (only a key like `submit:<ip>` with a counter, expiring within the hour),
      but the privacy page should say so plainly rather than leave it implicit
- [ ] Note for later: `lib/rate-limit.ts` hits Supabase via RPC
      (`rate_limit_hit`) on every single call — one DB round-trip per check, no
      in-memory layer in front of it. Fine at current volume; worth moving to an
      edge KV store (e.g. Upstash) only if traffic grows enough to make that
      round-trip matter
- [ ] **Fail-open has no floor.** If Supabase is unreachable the limiter is not
      degraded, it is *absent* — an attacker who can make the store time out
      gets unlimited uploads. The edge KV move above is the fix that actually
      holds; an in-memory fallback does not, and `DECISIONS.md` records why.
      Recorded rather than actioned: the fail-open choice was deliberate and
      stays until traffic justifies the move

## 🟡 4. The PDF viewer fails to a transparent hole

When the canvas fails to paint for any reason, the viewer renders **nothing** —
and because there is no opaque background behind it, the result is a see-through
gap where the paper should be. On one machine this showed the desktop through
the browser window. The site looks broken rather than the paper.

This matters more here than it would elsewhere. A site built around anonymity
draws visitors on hardened, unusual and privacy-patched browsers — Tor Browser
ships `resistFingerprinting` on by default — and canvas is exactly the surface
those setups interfere with. The failure is silent: the reader sees a blank page
and the site looks fine to everyone else.

The cause is out of our control (§4a). These mitigations are the deliverable.

Two of the four mitigations shipped 2026-09-03: the canvas container now paints
an opaque `var(--card)` ground, so a paint failure degrades to a blank page
rather than a hole, and every viewer carries a plain "Can't see the paper?
Download the PDF" line under it — the one path verified to work on a machine
where canvas paint fails, no longer hidden in the header.

- [ ] An `<object>`/`<iframe>` fallback to the browser's native PDF view is
      still worth having for the general case, but **cannot be the only
      fallback** — it fails identically on the affected profile. See
      `DECISIONS.md`
- [ ] Consider capping `devicePixelRatio` on `<Page>`; oversized canvases are a
      common paint-failure trigger. (No help on hardened Firefox, which already
      forces it to 1, but cheap insurance on HiDPI displays)

## 🟠 4a. What actually fails on the hardened Firefox profile

Diagnosis only — the deliverable is §4. `DECISIONS.md` carries the retraction
that reopened this: the render is **transparent**, not white, so rendering never
started at all, and GPU compositing is back to being the leading hypothesis.

This section exists so the diagnosis is not re-litigated.

- [ ] **The one test that settles it:** open a completely unrelated PDF from
      some other domain in that same Firefox profile. Transparent too → the
      browser/profile is confirmed, and this file is exonerated for good.
      Renders normally → the file is back in scope, and "PDF file corruption —
      ruled out" needs reopening as well
- [ ] Check `about:support` → Graphics in that profile: WebRender status,
      compositor, and any listed failure logs. Try toggling
      `gfx.webrender.software` to isolate the compositor
- [ ] Check for canvas-blocking *extensions* (CanvasBlocker, NoScript). This was
      **not** covered by "disabling fingerprinting protection changed nothing" —
      Firefox's built-in `resistFingerprinting` and an extension that stubs out
      `getContext("2d")` are different mechanisms, and only the first was tested
- [ ] Whatever the cause, it is out of our control. §4's mitigations are the
      deliverable

## 🟡 6. PDF metadata stripping — shipped, two gaps

Both routes strip the Info dictionary and delete the XMP `/Metadata` stream from
the pdf-lib context (not merely unlink it — pdf-lib does not garbage-collect, so
the naive delete leaves the name in the file bytes). Verified with a byte-scan
test. The full rewrite also flattens incremental-save revision history.

`DECISIONS.md` carries the adversarial review that found both passes' flaws, and
the full list of what still survives a strip.

- [ ] UI copy: "we strip file metadata but cannot remove your name if it's
      written into the document." Visible bylines, comments and image EXIF are
      still not covered and need human review before publishing
- [ ] Not covered by the current strip: embedded attachments, document-level
      JavaScript, annotations. Decide whether to drop them too

## 🟡 7. Orphaned uploads — covered in code, not yet automated

Both submit routes now track `uploadedPath` from the moment the upload commits
until the row exists, and discard it on the insert-error branch and in the outer
`catch`. `lib/storage-cleanup.ts` holds `removeStoredPdf` and
`discardOrphanedUpload`, which removes a path only when the database confirms no
row claims it — so a committed-but-timed-out insert never loses its file.
Rejection already deletes the stored PDF. Two sweep scripts exist, and
`DECISIONS.md` records the dry run that proved they agree.

- [ ] Nothing to `--apply` yet. Re-run `scripts/cleanup-orphaned-pdfs.mjs` after
      the next stretch of live submissions — that is when a killed function
      would actually leave something behind
- [ ] **No automated retention.** Both sweeps are manual scripts someone has to
      remember to run. Rejected papers keep their row forever and their file
      until a human runs the cleanup. Candidate: a second entry in
      `vercel.json`'s `crons` that runs the same sweep on a schedule past a
      grace window. Only worth wiring once there is enough submission volume for
      the queue to grow — today the whole bucket is 36 files

## 🟠 9. Cloudflare Turnstile

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
      plan covered only the word endpoint and left long-form unprotected
- [ ] **`/contact` and `/comments` are in scope too.** Both were unthrottled
      until 2026-09-03 and both send email; they now carry per-IP limits that
      fail open, which makes Turnstile the real boundary on exactly those two
      routes. The contact form is where traffic actually arrives
- [ ] Fail **closed**, not open. "Verify only when `TURNSTILE_SECRET_KEY` is
      present" means a typo'd env var silently disables verification. In
      production an absent secret should reject. Contrast §3's limiter, which
      may fail open because it sits behind a real check — this *is* the check
- [ ] Pass `remoteip` to siteverify

## 🟡 10. "What's Changed" — banner shipped, page still open

The home page has an expandable "What's new on the site" banner (native
`<details>`, no JavaScript) fed by `data/whats-new.ts`, with a footer linking
`CHANGELOG.md` and the repository.

The division of labour is settled and written into `data/whats-new.ts` as a
rule: **What's New is only what a visitor would notice.** Security work,
refactors, dependency bumps and schema changes go to `CHANGELOG.md`. If a reader
would not notice it while using the site, it does not go in the banner.

- [ ] `app/changes/page.tsx` — a full page, linked from `components/Nav.tsx`.
      The banner only shows the most recent handful; there is still nowhere to
      read the whole reader-facing history
- [ ] Decide the source for that page: keep hand-editing `data/whats-new.ts`, or
      move entries into a `changes` table so non-code updates (a new word of the
      month, newly published papers) can appear without a deploy. The hardcoded
      array is fine for the banner and will not stay fine for a page
- [ ] Optional: a subtle "new" marker in the nav when there are entries newer
      than the visitor's last visit (localStorage timestamp, no account needed)

## 🟡 11. Site email

The site has its own address: **weare.HumansOnPlanetEarth@gmail.com**. It
already receives the admin alerts for new papers and contact messages via
`ADMIN_NOTIFY_EMAIL`.

Published as the public address 2026-09-03 — on the About page's "Get in touch"
close and on the privacy page as the route for takedown or correction requests.
It lives in one place, `lib/site-contact.ts`, so the two pages cannot drift.

- [ ] Use it as the `from`/reply-to for outbound notification email — note
      Resend can't send *from* a `gmail.com` address; `NOTIFY_FROM_EMAIL` stays
      on the site domain with this address as reply-to
- [ ] **Unsubscribes don't reach Resend.** `lib/unsubscribe.ts` flips our own
      `notification_prefs`, which is enough to stop *us* sending — but nothing
      is recorded on Resend's side, so there is no suppression list and no
      visibility into bounces or complaints. That only starts to matter when
      deadline reminders go out at volume, at which point a rising complaint
      rate would quietly degrade delivery of the admin alerts too. Wire Resend's
      bounce/complaint webhooks before that happens

## 🟠 13. No startup validation for environment variables

No `@t3-oss/env-nextjs`, no zod schema, nothing validates `process.env` at boot.
A missing or malformed critical var (`ADMIN_PASSWORD`, `UNSUBSCRIBE_SECRET`,
`CRON_SECRET`, `TURNSTILE_SECRET_KEY`) only surfaces at first use — sometimes
silently, as §9 flags specifically for Turnstile.

- [ ] Validate critical env vars at module load (a small zod schema, or
      `@t3-oss/env-nextjs`) so the app fails loudly at boot instead of degrading
      silently at request time

## 🟠 14. Sign-in codes, and one proposed word per account — PLANNED, NOT STARTED

Nothing below is built.

**Sign-in codes.** `/account` sends a magic link only, and the link works *only
in the browser that requested it* — `DECISIONS.md` records why. Request a link
on a laptop, open the mail on a phone, and there is no way in and no recovery
path. A 6-digit code typed back into the original tab closes that. Sign-in and
account creation are already one action (`shouldCreateUser` defaults to `true`),
so there is no second flow to build — only copy that says so.

**One proposed word per account.** Words are admin-only today. One *lifetime*
proposal per account — not one per month — is a self-limiting way to let readers
feed the prompt queue. Paper submission stays anonymous and account-free; this
is purely additive.

- [ ] **Answer this before writing any code.** Add `{{ .Token }}` to the Magic
      Link and Confirm signup templates *alongside* `{{ .ConfirmationURL }}`
      (both may coexist; the link must stay — replacing it with
      `{{ .TokenHash }}` broke sign-in entirely once already). Then call
      `verifyOtp({ email, token, type: "email" })` and see whether a session
      comes back. If it does, the code and PKCE coexist and the request side
      needs no change at all. If it does not, GoTrue is refusing the plain token
      for a PKCE-issued OTP the same way it refuses `token_hash`, and the
      fallback is to move the OTP *request* server-side to a client built with
      `createClient` + `auth: { flowType: "implicit" }` (plain `supabase-js`
      does not force PKCE). That fallback returns tokens in the URL *fragment*,
      which a route handler cannot read, so `/auth/confirm` would also need a
      small client component letting `detectSessionInUrl` consume the hash — but
      it would make links work cross-device, closing that limitation outright.
      **Record the answer in `DECISIONS.md` either way.** This is the second
      time the PKCE hard-coding has shaped a design; it should not be
      rediscovered a third
- [ ] `app/api/auth/verify-code/route.ts` — POST `{ email, token }`, token
      matching `/^\d{6}$/`, rate-limited `verify-code:<ip>` at 10 per 15 min
      like `app/api/admin/login/route.ts`. Note in a comment that Supabase's own
      attempt cap is the real boundary against a 6-digit brute force, since
      `rateLimit` fails open
- [ ] `app/account/AccountLogin.tsx` — the `status === "sent"` panel is
      currently a dead end. Give it a code input (`inputMode="numeric"`,
      `autoComplete="one-time-code"`, `maxLength={6}`), a Verify button, and a
      "use a different email" way back. Keep the honeypot and the `?error=link`
      branch. Leave `app/auth/confirm/route.ts` alone unless the fallback lands
- [ ] `supabase/migrations/0004_word_proposals.sql` — `word_proposals` with
      `profile_id uuid not null unique references profiles(id) on delete
      cascade`. The UNIQUE *is* the cap, enforced in the database rather than
      the route, so a double-submit cannot slip two through. RLS on, zero
      policies, like `profiles`. **Two consequences, deliberate:** a declined
      proposal does not return the slot (the admin deletes the row to grant
      another go), and deleting your account frees it via the cascade — the one
      bypass. Mirror into `supabase/schema.sql`. **Manual to apply — see §1a**
- [ ] `lib/word-format.ts` — `normalizeWord` (lowercase + trim, matching
      `app/api/admin/words/route.ts`) and `isValidWord`. That file is
      deliberately supabase-free so the client form and the server routes can
      share one definition
- [ ] `app/api/account/word/route.ts` — GET the caller's proposal, POST to
      create. Reject a word already in `words`. Return 409 both from the
      read-then-write check *and* from the unique-violation the check races
- [ ] `app/account/AccountDashboard.tsx` — a "Your Word" section, loaded in the
      existing `Promise.all`. Copy says plainly: one word, once, an editor
      decides
- [ ] `app/api/admin/word-proposals/route.ts` plus a fifth admin tab with a
      pending badge. Accepting only marks it accepted — it does not create the
      word, because month/year/deadline still have to be chosen in `AddWordForm`
- [ ] Tests: `auth-verify-code`, `account-word`, `admin-word-proposals`, and
      `normalizeWord`/`isValidWord` in `tests/lib/words.test.ts`
- [ ] `README.md` — `word_proposals` in the tables list, and a line that the
      auth templates must carry **both** `{{ .ConfirmationURL }}` and
      `{{ .Token }}`

## 🟠 15. Drain the plan sheets

`~/.claude/plans/` holds 8 working sheets, ~73 KB, unversioned and outside the
repo. They are unreliable as a record by construction: names are auto-generated
from opening words plus a random pair (`your-current-7-correctly-floofy-clarke.md`),
so you cannot find one by topic, and they are not in git, not backed up with the
code, and lost with the machine.

The rule is now: **a plan is scratch.** Anything that must survive is restated
in `TODO.md` or `DECISIONS.md` before the job closes, then the sheet is deleted.
This is the §1a failure in miniature — the reasoning grew in one place while the
record lived in another, and nothing reconciled them.

- [ ] Read the 8 existing sheets for anything not yet promoted, promote it to
      `TODO.md` or `DECISIONS.md`, then delete them. Do this once; after that
      the rule keeps the directory empty on its own

## 🟠 17. Nothing tells you the profile id an attachment needs

The Published tab has "Attach to profile", posting to `/api/admin/attach`, which
requires a raw profile UUID. Nothing in the app will tell you what that UUID is.
The only route today is the Supabase dashboard — find the person in `auth.users`,
then find their `profiles` row — which is why the feature goes unused.

`profiles` carries `email`, so the lookup is one query away. It has to run behind
`getAdminClient()`: RLS is on with zero policies, and `DECISIONS.md` records what
that client's `any` return type costs.

- [ ] Accept an **email** in the attach field and resolve it server-side in
      `app/api/admin/attach/route.ts`, keeping the UUID path — take either
- [ ] Or an admin lookup that takes an email and returns the profile id and
      creation date. One endpoint can serve both; the lookup is the more useful
      half, because it also answers "does this person have an account at all"
- [ ] Whichever ships stays private. Attachment writes `public_visible: false`,
      `papers` is deliberately author-free, and none of this gains a public
      surface — see the tripwires in `DECISIONS.md`
- [ ] **Question, not a plan:** should the submitter be able to claim a paper
      themselves — a claim code shown once at submit time, entered later on
      `/account`? It removes the admin step entirely, but it puts an identifier
      linking a person to an anonymous paper into an inbox or a screenshot.
      Decide before building either version

## Housekeeping

- [ ] No pre-commit hooks exist (`.husky/` absent, no `prepare` script). Add
      husky + lint-staged to run lint/typecheck before commit — this is the same
      class of failure (`package.json`/`package-lock.json` drift) that already
      broke `npm ci` once. Deferred by choice on 2026-08-29, but the blocker is
      gone: lint is at zero, so a hook that runs it would pass today rather than
      failing on first use
- [ ] `paper_authors.public_visible` is dormant — the public author page was
      removed before release and the column was kept "in case sharing returns".
      Give it a decision date or drop it; a column nothing reads is a question
      every future reader of the schema has to re-answer
