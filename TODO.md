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
One thing found while ordering the work is **not** here because it shipped in the
same pass: `/api/contact` and `/api/comments` had no rate limit at all, and now
do; it is in `CHANGELOG.md`, its fail-open reasoning is in `DECISIONS.md`, and
§9's scope was widened to cover both routes. Pushed as `f832bf0`.

Added 2026-09-15: §20, a word queue that accounts can add to, ordered so that
everyone's first waiting word is considered before anyone's second. §14 was
split in the same pass — it carried two unrelated jobs, and its word half is
replaced wholesale by §20's different design. The reversal of "one *lifetime*
proposal per account" is dated in `DECISIONS.md` rather than quietly applied.
Nothing was built; this is the design, recorded.

Added 2026-10-26: §21, Reading Rooms, an asynchronous book club. Its scope was
decided with Seb on 2026-10-22 in a plan sheet. This section promotes that
sheet, so the sheet can be deleted. Nothing was built. It adds a migration, so
it queues behind §1a in the same way §20 does.

Swept 2026-10-26: §15, §13 and §22 are done and have left. `DECISIONS.md` records what the
drain found, which was not what §15 assumed. §13 was un-parked the same day by
Seb's call, as part of the new running order below, and shipped. It also closed three
places where a missing secret opened a security check instead of closing it.
`CHANGELOG.md` has those; the un-parking is dated in `DECISIONS.md`.

**The running order, set 2026-10-26.** It replaces the 2026-09-03 order, which
`DECISIONS.md` keeps. It is recorded here, not in a plan sheet, because the
sheet gets deleted and this file does not. The order follows dependencies, not
size:

1. **Done 2026-10-26:** the production rate-limit checks, §15, and §13.
2. **Done 2026-10-26:** the pre-commit hook, and §22 (the Next.js security
   bump, 16.2.2 → 16.4.3).
3. **§1a**, before any feature that adds a migration. §20 and §21 both add
   one. **Live 2026-10-26.**
4. **§14, then §9**, before the features rather than after them. §20 and §21
   are account-only, and §14 is what fixes sign-in across devices. §21 adds
   three public write routes, so Turnstile should land before them rather
   than be retrofitted.
5. **§20, then §21.** §20 is smaller, and §21 reuses its cap trigger and its
   admin-tab recipe. Whichever lands first takes migration `0004`.
6. **§10's full page**, alongside §21, which is the first change a visitor
   will really notice.
7. **Any time, in any order:** §17 (still parked by Seb's call, 2026-09-03),
   §6's UI copy, §4's fallbacks, §11's Resend webhooks (before §20 and §21
   raise email volume), and §3's privacy-page wording.
8. **Waiting on something outside the code:** §2 (a decision), §4a (a person
   at the hardened Firefox profile), §7's automation (submission volume), and
   §3's edge KV move (traffic).

One verification is still owed from production: that comment threads follow
the paper when paging fast. It needs a person at a browser. The contact 429 was
proved on 2026-10-26, along with §3's upload 429; `DECISIONS.md` has the method.

---

## 🟡 1a. Migrations are automatic — two loose ends

**Live 2026-10-26.** Every push to `main` runs `.github/workflows/deploy.yml`,
which checks, then migrates, then deploys. Production can no longer lag the
repo without a red X saying so. `DECISIONS.md` has the design and the proof
from the first green run; `README.md` has the setup; `CHANGELOG.md` has what
shipped. This was the cause of the six-missing-tables outage, and it is closed.

- [ ] **A baseline dumped from production**, so a from-scratch setup no
      longer depends on `schema.sql`, which isn't safe to rerun and is known
      to differ from production. Use `supabase db dump --schema public` into
      `0000_baseline.sql`, then `migration repair --status applied 0000`. It
      needs Docker or `pg_dump`, and this machine has neither. The
      automation doesn't need it
- [ ] **Rotate the database password once more.** The current one was typed
      into a Claude Code chat while the setup was being done, so it sits in
      the local transcript. Reset it, save it with `read -rs` straight into
      `~/.config/humansonplanetearth/supabase-db-password`, and update the
      `SUPABASE_DB_URL` secret. Nothing in the site uses the password; only
      the workflow and the CLI do
- [ ] Housekeeping for the workflow: the run log warns that `actions/checkout@v4`
      and `supabase/setup-cli@v1` target Node 20, which GitHub is retiring.
      Bump them when their Node 24 versions are out. They are only warnings
      today

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

## 🟡 3. Upload hardening — shipped, with three open threads

Both upload routes are rate-limited through a shared Postgres store (word papers
5/hour/IP, long-form 3/hour/IP), both share one `MAX_UPLOAD_SIZE` of 4.5 MB from
`lib/upload-limits.ts`, and oversized uploads warn clearly under the dropzone.
`DECISIONS.md` records how the limiter was proved in production.

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

## 🟠 14. Sign-in codes — PLANNED, NOT STARTED

Nothing below is built. This section used to carry a second, unrelated job —
one proposed word per account. That is now **§20**, with a different design; the
reversal is dated in `DECISIONS.md`. What is left here is only sign-in.

`/account` sends a magic link only, and the link works *only in the browser that
requested it* — `DECISIONS.md` records why. Request a link on a laptop, open the
mail on a phone, and there is no way in and no recovery path. A 6-digit code
typed back into the original tab closes that. Sign-in and account creation are
already one action (`shouldCreateUser` defaults to `true`), so there is no
second flow to build — only copy that says so.

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
- [ ] Tests: `auth-verify-code`
- [ ] `README.md` — a line that the auth templates must carry **both**
      `{{ .ConfirmationURL }}` and `{{ .Token }}`

## 🟠 17. Nothing tells you the profile id an attachment needs

**Parked 2026-09-03, Seb's call** — this was next and is held. Open, not
deferred: nothing here was decided against, and the design below stands as
written.

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

## 🟠 20. A word queue accounts can add to — PLANNED, NOT STARTED

Nothing below is built. This replaces the word half of §14, which planned **one
*lifetime* proposal per account** enforced by a `UNIQUE (profile_id)`. The
reversal and its reasoning are dated in `DECISIONS.md`.

Words are admin-only today: `app/api/admin/words/route.ts` is the only way one
is ever created, and there is no queue of any kind — a word is "current" purely
because its `(month, year)` matches today. Nothing in the schema carries a
status, a position, or an idea of "next".

**The queue is fair, not first-come-first-served.** Round is a word's position
among *its own author's waiting words*, oldest first; the queue sorts by round,
then by age. Everyone's first waiting word is considered before anyone's second.

```
Ana proposes "tide"  →  her round 1
Ana proposes "salt"  →  her round 2
"tide" is used as a word of the month
Ben proposes "ash"   →  his round 1

Queue: salt (round 1, older), ash (round 1)
```

The round is **derived at read time — there is no stored ordinal column.**
Nothing to assign under a race, nothing to renumber when a row leaves, nothing
that can disagree with the rows.

Four decisions, taken 2026-09-15:

| Question | Decision |
| --- | --- |
| Does a word leaving the queue free your front-row place? | **Yes** — round is computed over *waiting* words only |
| How many waiting words per account? | **3** |
| What does the admin "accept" do? | **Prefills the existing `AddWordForm`**; creating the word marks the proposal used |
| What does the proposer see? | **Status only** — waiting / used / declined. No round, no position |

**The table.**

```sql
create table word_proposals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  word text not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'used', 'declined')),
  used_word_id uuid references words(id) on delete set null,
  created_at timestamptz default now(),
  decided_at timestamptz
);

create index word_proposals_queue_idx on word_proposals (status, created_at);
create index word_proposals_profile_idx on word_proposals (profile_id);

-- Two people cannot have the same word waiting at once. Partial, so a declined
-- word can be proposed again and a used one is governed by words.word's UNIQUE.
create unique index word_proposals_waiting_word_idx
  on word_proposals (word) where status = 'waiting';

alter table word_proposals enable row level security;
-- RLS on, ZERO policies — like profiles.
```

**The cap is a trigger, not a UNIQUE.** "At most 3 waiting" cannot be written as
a `UNIQUE`, and a read-then-write count in the route loses to a double-click. A
`before insert` trigger taking `pg_advisory_xact_lock(hashtext(profile_id))`
before counting is exact, and raises `word_proposal_cap` as a `check_violation`.
This check **fails closed** — it *is* the cap, not mitigation sitting behind
one, which is the distinction `lib/rate-limit.ts:22-35` exists to make.

**Three deliberate consequences.** Deleting your account frees your waiting
words via the cascade and erases that a used word came from you, while the
`words` row survives untouched. A declined word can be proposed again, by its
author or anyone else. `word_proposals` is never joined to `papers`, which stays
author-free — see the tripwires in `DECISIONS.md`.

- [ ] `supabase/migrations/0004_word_proposals.sql` — the table, the three
      indexes, the trigger, RLS on with zero policies. Mirror into
      `supabase/schema.sql`, following the `0003_rate_limits.sql` precedent that
      tells a from-scratch setup to run the migration rather than copy from
      there. Applied by the deploy workflow on push (§1a); write it to be safe to run twice. Confirm the trigger exists, not just
      the table: `select tgname from pg_trigger where tgrelid =
      'word_proposals'::regclass;`
- [ ] `lib/word-format.ts` — `normalizeWord` (lowercase + trim, matching what
      `app/api/admin/words/route.ts` inlines today) and `isValidWord` (2–24
      characters, `a-z` plus internal `'` or `-`, a letter at each end — which
      rejects the `__long-form__` sentinel without a special case). That file is
      deliberately supabase-free so the client form and the server routes share
      one definition. Then **replace the inline `word.toLowerCase().trim()` in
      `app/api/admin/words/route.ts`** with it, so there is one definition
      rather than two that can drift
- [ ] `lib/word-queue.ts` — `orderWordQueue`, pure, modelled on
      `lib/admin-queue.ts` so the ordering is testable without a DOM or a
      database. Tie-break on `id`; `created_at` carries no uniqueness
- [ ] `app/api/account/words/route.ts` — GET own proposals, POST to add, DELETE
      to withdraw a waiting one. Shaped like `app/api/account/prefs/route.ts`:
      `getSessionUser()` → 401, `req.json()` in a try/catch → 400, hand-rolled
      validation, `ensureProfile` → 500, then scoped by `.eq("profile_id",
      profile.id)` — never a client-supplied id. Rate-limited
      `word-proposal:<ip>` at 10/hour, commented as mitigation that **fails
      open** with the trigger as the real cap. Return 409 from the
      read-then-write checks *and* from the unique index and trigger those
      checks race
- [ ] DELETE is scoped `status = 'waiting'` as well as by profile, so a used or
      declined row cannot be touched. It exists because a hard cap of 3 with no
      way to take back a typo leaves a slot dead forever
- [ ] `app/api/admin/word-queue/route.ts` — GET the ordered waiting list, PATCH
      to decline (same shape as `app/api/admin/review/route.ts`'s PATCH; sets
      `decided_at`). Returns **no proposer email and no profile id**: the admin
      needs the round, not the identity, and nothing else on this site puts a
      name next to a contribution
- [ ] `app/api/admin/words/route.ts` — optional `proposalId` on POST; on a
      successful word insert flip it to `used` with `used_word_id` and
      `decided_at`. Do it **in this route**, so the word and the proposal cannot
      end up disagreeing, wrapped in `try/catch` + `console.error` like the
      existing `notifyNewWord(created)` call so it can never fail word creation
- [ ] Same route: return **409** on the `words.word` unique violation instead of
      today's 500 with a raw Postgres message. A queued word can be added by
      hand in the meantime, and that is a real collision, not a server fault
- [ ] Admin UI goes **inside the existing Words tab, not a fifth one** — §14
      specified a fifth tab, and the prefill decision makes that wrong: the
      queue and the form it fills belong on one screen. New `WordQueuePanel.tsx`
      above `AddWordForm`; `AdminData.tsx` gains a `"queue"` dataset (type,
      state, `refresh` branch, `ALL_DATASETS` entry, `useMemo` field *and*
      dependency) plus `declineQueued` and `useQueued`; `AdminDashboard.tsx`
      gains one line, `words: queue.length` in `badges`
- [ ] `app/account/AccountDashboard.tsx` — a "Your Words" section loaded in the
      existing `Promise.all`. Status only, a withdraw link on waiting rows, and
      `2 of 3 waiting` — which is what makes a 409 comprehensible. Copy says
      everyone's first word is considered before anyone's second, and that an
      editor decides which are used and when
- [ ] Tests: `tests/lib/word-queue.test.ts` (the worked example above, an empty
      queue, one account holding all three rounds, a `created_at` tie),
      `normalizeWord`/`isValidWord` in `tests/lib/words.test.ts`,
      `tests/api/account-word.test.ts`, `tests/api/admin-word-queue.test.ts` —
      including that the response carries no email or profile id — and an
      extension to `tests/api/admin-words.test.ts` for the `proposalId`
      transition
- [ ] `README.md` — `word_proposals` in the tables list, and a line that
      migration `0004` is applied by the deploy workflow
- [ ] **The one thing unit tests cannot prove:** two concurrent POSTs for a
      third word must land exactly one row. That is the advisory lock's whole
      purpose, and it needs a real database to check

## 🟠 21. Reading Rooms — an asynchronous book club — PLANNED, NOT STARTED

Nothing below is built. "Reading Rooms" is a working name. Scope was decided
with Seb on 2026-10-22.

A signed-in account opens a **room** around a book or a film and breaks it into
**sections** — chapters, acts, timestamps, or the whole work at once. People
write **pages** about a section: considered, typed, anonymous, published as
*Human On Planet Earth*. Under each page sit **margins**: short replies, one
level deep, the shape `components/Comments.tsx` already has. Nothing on the site
touches books or films today, comments only attach to a word (long-form fakes
one with the `__long-form__` row), and every contribution is a PDF — so pages
are the first typed text on the site.

Seven decisions, taken 2026-10-22:

| Question | Decision |
| --- | --- |
| How is a work broken down? | **Creator's choice** — chapters, acts/parts, timestamps, or whole work. All are ordered rows with free-text labels, so every shape is the same data |
| Is there a closing section? | **Yes, always** — every room gets a final "The whole work" section, added automatically |
| How are spoilers handled? | **Manual expand.** Every section starts collapsed; the reader opens the one they want. No reading-position tracking |
| Can a page point at a passage? | **Yes** — optional `quote` (≤300 chars, to stay inside fair use) and `locator` (≤40, e.g. "p. 112", "1:04:30"), shown as a pull-quote |
| Is the work looked up anywhere? | **Open Library, fully built in v1**, for books only — it does not catalogue films |
| Do rooms need approval? | **No — live instantly.** Abuse control is a cap, a rate limit, and an admin Remove |
| Do pages need approval? | **Yes**, through the admin queue like papers — they carry the most risk. Margins publish instantly, like comments |

**Two things are deferred, not dropped:** a *pace* (each section gets an "opens
on" date, say a chapter a week, and shows as *upcoming* until then) and a
*prompt per section* (one word or question from the creator — "Chapter 3 —
*debt*" — which ties a room back to the monthly word). The schema leaves room
for both as `opens_at` and `prompt` on `room_sections`; neither is in v1.

**The room cap fails closed; the rate limit fails open.** At most 3 rooms per
account per 24h, enforced by a `before insert` trigger taking
`pg_advisory_xact_lock(hashtext(...))` before counting — the same pattern §20
uses, for the same reason: a read-then-write count in the route loses to a
double-click. The cap *is* the boundary. The IP `rateLimit` on top is mitigation
and is commented as such, per `lib/rate-limit.ts`.

**The Open Library lookup is a convenience, so it fails open.** If it times out
or finds nothing, the form says so and manual entry still works. What *is*
checked server-side is what gets stored: `ol_work_key` must match
`^/works/OL\d+W$` and `cover_id` must be an integer, so a client cannot plant an
arbitrary URL that the room page then renders.

**Migration number clash.** §20 already claims `0004`. Whichever of the two
ships first takes `0004`; the other takes `0005`. Since 2026-10-26 the deploy
workflow applies both (§1a).

- [ ] Migration `supabase/migrations/000N_reading_rooms.sql` (see the clash
      above). Mirror into `supabase/schema.sql` per the `0003_rate_limits.sql`
      precedent. The deploy workflow applies it (§1a); confirm the cap trigger exists,
      not only the tables, via `pg_trigger`:
  - `rooms` — id, slug, title, `creator_name` (author of the *work*, not of the
    room), medium (book / film / series / play / other), year, intro,
    `ol_work_key`, `cover_id`, `isbn` (all nullable), status (`live` /
    `removed`), `created_at`. Public read where live
  - `room_sections` — id, `room_id`, position, label, kind (`part` / `whole`).
    Public read where the room is live
  - `room_pages` — id, `section_id`, title, body (plain text, ~10k cap), quote,
    locator, status (`pending` / `approved` / `rejected`). Public read where
    approved
  - `room_margins` — id, `page_id`, `parent_id`, body (2000 cap). Same shape as
    `comments`
  - `room_authors`, `room_page_authors`, `room_margin_authors` — RLS on, **zero
    policies**. Public tables never hold an author; this is the `papers` tripwire
    in `DECISIONS.md` carried over, not a new rule
- [ ] `lib/rooms.ts` — pure: slugify, build sections (always appending
      `whole`), validate labels
- [ ] `lib/open-library.ts` — `searchWorks`, `parseSearch`, `parseToc`,
      `coverUrl`, `isWorkKey`
- [ ] `app/api/rooms/lookup/route.ts` — `GET ?q=`, the only thing that talks to
      Open Library; the browser never calls it directly. IP rate-limited 30/min
      (fails open). Queries `search.json` with `limit=8` and a `fields=` list,
      sends a descriptive `User-Agent` with the site URL as Open Library asks,
      4s `AbortController` timeout, `next: { revalidate: 86400 }`. Returns
      `{workKey, title, authors, year, coverId, isbn}`
- [ ] `app/api/rooms/lookup/toc/route.ts` — `GET ?edition=`, reads
      `table_of_contents` from `books/{edition}.json`. Best effort: when present
      it prefills the breakdown as editable chapters; when absent the creator
      builds it by hand
- [ ] `app/api/rooms/route.ts` (create, account required),
      `app/api/rooms/pages/route.ts`, `app/api/rooms/margins/route.ts` — each
      shaped like `app/api/submit/route.ts`: `rateLimit` + `clientIp`, the
      `_trap` honeypot, length caps, `getSessionUser` / `ensureProfile`,
      `notifyAdmin…` for new pages. 409 on the cap trigger's `check_violation`
- [ ] Pages: `app/rooms/page.tsx` (list), `app/rooms/[slug]/page.tsx` (the work
      and its sections), `app/rooms/[slug]/[section]/page.tsx` (that section's
      pages and the write form), `app/rooms/new/` (create form with a section
      builder and, for books, a search box with cover thumbnails that fills
      title, creator, year and stores the Open Library ids)
- [ ] Spoiler folding: on the room page each section is a collapsed `<details>`
      showing only label and count ("Chapter 4 · 6 pages"). Pages load **lazily
      on open**, so no page text is in the HTML for anyone to skim. The section
      deep link counts as an explicit expand. No stored state
- [ ] Covers from `covers.openlibrary.org/b/id/{cover_id}-M.jpg` — either add
      the host to `images.remotePatterns` for `next/image`, or a plain `<img
      loading="lazy">`. The room page credits "Book data from Open Library"
- [ ] Margins: generalise `components/Comments.tsx` (`buildTree`,
      `CommentForm`) rather than copying it
- [ ] Nav: one entry in `components/Nav.tsx`'s `links`
- [ ] Admin: a "Rooms" tab in `AdminDashboard.tsx` — pending pages (approve /
      reject) and live rooms (remove), badged on pending pages. Datasets and
      actions in `AdminData.tsx`, `useMemo` field *and* dependency.
      `app/api/admin/rooms/route.ts` behind `isAdminRequest`, following §20's
      recipe
- [ ] Tests: `tests/lib/rooms.test.ts` (ordering, the `whole` section always
      last), `tests/lib/open-library.test.ts` (recorded JSON fixtures; `isWorkKey`
      rejects arbitrary input), `tests/api/rooms*.test.ts` (auth, rate limit,
      honeypot, caps, and **that no response carries an author**),
      `tests/api/rooms-lookup.test.ts` (mocked `fetch`: timeout, non-200, empty)
- [ ] By hand on `npm run dev`: a 3-chapter room is live at once with "The whole
      work" as a fourth section; a page with a quote is pending, then shows once
      approved; a margin posts; every section is collapsed on load and no page
      text is in the source until opened; "Middlemarch" fills cover, fields and
      (where available) chapters; with openlibrary.org blocked, manual entry
      still works; a removed room 404s; a 4th room inside 24h is refused
- [ ] **The one thing unit tests cannot prove:** concurrent creates at the cap
      must land exactly one row — the advisory lock, against a real database
- [ ] On ship: `CHANGELOG.md`, `data/whats-new.ts`, `README.md` tables list

## Housekeeping

- [ ] **Nine dev-tooling advisories are left** after §22 (4 moderate, 5 high):
      vitest and `@vitest/mocker`, vite, js-yaml, brace-expansion, nanoid,
      source-map-js and `@humanfs/node`. None of them runs in production. Each
      has a non-major fix, but `npm audit fix` on npm 10.9.2 crashes with
      `Cannot read properties of null (reading 'edgesOut')` before it writes
      anything. Try a newer npm, or bump `vitest` and
      `@vitest/coverage-v8` by hand, which covers most of them
- [ ] `paper_authors.public_visible` is dormant — the public author page was
      removed before release and the column was kept "in case sharing returns".
      Give it a decision date or drop it; a column nothing reads is a question
      every future reader of the schema has to re-answer
