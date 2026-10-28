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

**Section numbers never change.** Comments in shipped code, tests and
scripts cite them — `app/api/contact/route.ts` and `tests/api/contact.test.ts`
(§1a), both cleanup scripts (§7, §2), `data/whats-new.ts` (§10),
`CHANGELOG.md` (§4), and the §14, §20 and §21 code added 2026-10-26.
`lib/rate-limit.ts` cited §9 until §9 was ruled out on 2026-10-26. Renumbering breaks all of them
silently; nothing would fail a build. The gaps where §1, §5, §8 and §12 used to
sit are correct — those sections are done, and live in `CHANGELOG.md` and
`DECISIONS.md` now.

New work gets the next free number before `## Housekeeping`.

Last swept 2026-10-27 (§21: room requests). Before that, 2026-08-30: the lint work committed and pushed (`8dd7024`), the 12
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

Swept 2026-10-26: §15, §13 and §22 are done and have left. §9 has left too,
ruled out rather than done. `DECISIONS.md` records what the
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
4. **§14, before the features.** Live 2026-10-26. §9, Turnstile, was ruled
   out the same day by Seb's call; `DECISIONS.md` has the reasoning, and the
   work is kept as the tag `archive/turnstile`.
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
- [ ] **Open question for Seb, 2026-10-26: where does this page's history
      come from?** `CHANGELOG.md` was considered and set aside, because it is
      written for developers (migration numbers, advisories). The remaining
      options are an archive array beside `WHATS_NEW`, which would restore
      the entries trimmed from the banner, or the `changes` table below
- [ ] **Since 2026-10-26 `data/whats-new.ts` holds at most five entries**
      (Seb's call; a test enforces it), so it can no longer be the full
      history this page shows. The page needs its own source
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

## 🟡 14. Sign-in codes — built, waiting on a browser test

The design question is answered; nothing is built yet. This section used to
carry a second, unrelated job, one proposed word per account. That is now
**§20**, with a different design, and the reversal is dated in `DECISIONS.md`.
What is left here is only sign-in.

`/account` sends a magic link only, and the link works *only in the browser
that requested it*; `DECISIONS.md` records why. Request a link on a laptop,
open the mail on a phone, and there is no way in and no recovery path.

**Answered 2026-10-26: the emailed code works cross-device.** A code from a
PKCE-requested email signed in from a client that never requested it.
`DECISIONS.md` has the experiment. So the request side doesn't change, no
server-side fallback is needed, and the code also closes the cross-device gap.
That makes it a bigger fix than the original plan, which only expected the
code to work in the requesting tab. Sign-in and account creation are already
one action (`shouldCreateUser` defaults to `true`), so there is no second flow
to build, only copy that says so.

**Codes are 8 digits in this project, not 6** (Authentication → Email OTP
length). The plan said 6 throughout, and would have rejected every real code.

**Already live:** both email templates (Magic Link and Confirm signup) carry
`{{ .Token }}` under `{{ .ConfirmationURL }}`, as a plain "Or enter this code
on the sign-in page" line. Until this section ships, that line promises
something `/account` can't do yet. Ship soon, or take the line out.

**Built 2026-10-26, not committed:** the route, the form, the shared
`lib/sign-in-code.ts`, tests and the README note. The one thing left is a real
round trip in a browser. The first attempt was blocked by §23's email cap
before any email went out.

- [ ] **Browser test:** request on `/account`, type the 8-digit code without
      clicking the link, and land on the dashboard. Try a wrong code once
- [ ] Reword the template line in the same voice as the rest of the email,
      once the code works on `/account`

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

## 🟡 20. A word queue accounts can add to — built, waiting on the live check

**Built 2026-10-26.** This replaces the word half of §14, which planned **one
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

**What was built**, all of it to the design above:

- **Migration `0004_word_proposals.sql`.** It ran **twice** in real Postgres
  (PGlite) without error. It enforced the cap, freed a slot when a word was
  used or declined, refused the same word waiting twice, allowed a declined
  word again, refused bad words at the database, kept the trigger and RLS
  present, and cascaded an account deletion. The pipeline applies it before
  the deploy.
- **The rules and the order.** `normalizeWord` and `isValidWord` live in
  `lib/word-format.ts`; `orderWordQueue` and `MAX_WAITING` in
  `lib/word-queue.ts`.
- **The routes.** `app/api/account/words/route.ts` lists, proposes and
  withdraws. `app/api/admin/word-queue/route.ts` lists and declines, and
  sends no identity. `app/api/admin/words/route.ts` takes `proposalId`,
  returns 409 on a duplicate, and uses `normalizeWord`.
- **The screens.** `WordQueuePanel` sits in the Words tab, where "Use this
  word" remounts `AddWordForm` keyed on the proposal; the tab is badged with
  the waiting count. `app/account/YourWords.tsx` is on the account page.

**Two deliberate departures from the plan above:**

- `YourWords` loads on its own rather than inside the dashboard's
  `Promise.all`, so a word-queue failure can't blank the account page.
- The admin route uses `normalizeWord` but **not** `isValidWord`. The strict
  rule is for proposals. Applying it to Seb's own word form could refuse a
  word he meant to publish.

- [ ] **Live check after the push.** Propose a word from an account; see it
      in the admin Words tab with its round; use it from the queue and check
      it shows as "Used" on the account page; decline another and check it
      shows "Not used"; withdraw a third
- [ ] **The one thing no test here can prove:** two concurrent POSTs for a
      third word must land exactly one row. PGlite has a single connection.
      This needs two real sessions against the real database

## 🟡 21. Reading Rooms — 21a built on a branch, 21b open

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

**Migration:** `0005_reading_rooms.sql`, since §20 took `0004`. The deploy
workflow applies it (§1a).

**Three decisions from 2026-10-26** (`DECISIONS.md` has the reasoning):

- **Pages and margins need no account.** Only opening a room does.
- **Two parts.** 21a is the core; 21b is the Open Library lookup.
- **No human check.** §9, Turnstile, was ruled out, and Seb kept margins as
  designed: anyone can post and they show at once. The honeypot and the
  per-IP limit are the only filters, so spam is cleared after the fact.

**One decision from 2026-10-27** (`DECISIONS.md` has it): **without an
account, a visitor can ask for a room.** Opening one still needs an account
and still goes live at once. A request is a hidden room (`status =
'requested'`) that goes live only when the admin opens it, so the 22 Oct "no
approval" row above still holds for accounts. Migration `0006_room_requests.sql`,
proved in PGlite the same day.

**21a, built 2026-10-26 on the local branch `rooms`, from `main`, not yet
pushed:**

- **Migration 0005.** One `create_room()` function does the cap, the room,
  its sections and the private author row, all or nothing, and it is revoked
  from the public roles.
- **Proved in PGlite (real Postgres),** as the public role with Supabase's
  default grants: rerunnable; the cap leaves no orphan; RLS shows only live
  rooms, approved pages and their margins; the author tables are invisible
  with zero policies; a direct `create_room` call is denied.
- **`lib/rooms.ts`** holds the rules. `lib/room-data.ts` holds the public
  reads, all through the anon client, so RLS decides.
- **Routes:**
  - `app/api/rooms/` creates a room; account required.
  - `pages/` takes a page from anyone; it waits for review and you get an
    alert.
  - `margins/` takes a margin from anyone, publishes at once, one level of
    replies.
  - `app/api/admin/rooms/` approves or rejects pages and removes rooms
    (marked removed, not deleted).
- **Screens:**
  - `/rooms` lists rooms.
  - `/rooms/[slug]` shows sections as collapsed `<details>`, whose pages are
    fetched only on open.
  - `/rooms/[slug]/[n]` is the deep link, which counts as opening the
    section, with the page form.
  - `/rooms/new` has a one-per-line section builder with a "chapters 1 to N"
    filler.
  - `components/Margins.tsx` reuses the comment thread's form and its now
    generic `buildTree`.
  - The admin dashboard gets a "Reading Rooms" tab.
- **Checked:** 485 tests, build clean. A production build serves `/rooms`,
  shows the sign-in prompt on `/rooms/new`, and returns 404 for an unknown
  room. A signed-out create gets 401.

- [ ] **Ship it:** merge `rooms` into `main`, and push. One deploy applies
      0005 and 0006
- [ ] **Live walk-through** after that deploy:
  - open a room with 3 parts and check "The whole work" is the 4th section
  - write a page with a quote and check it is pending; approve it in admin
    and check it shows
  - add a margin and a reply
  - check every section is closed on load, with no page text in view-source
  - remove the room and check it 404s
  - try a 4th room within 24h and check it is refused
  - signed out, ask for a room with an email; check it is hidden at its
    address, shows under "Rooms asked for" in admin, and that opening it
    makes it live and sends one email. Ask for another and decline it
- [ ] **Two real sessions** creating a 4th room at once must land exactly
      one. The advisory lock is for this, and PGlite has one connection

**21b, the Open Library lookup, not started.** It is designed in the 22 Oct
scope and is unchanged:

- [ ] `lib/open-library.ts`: `searchWorks`, `parseSearch`, `parseToc`,
      `coverUrl`, `isWorkKey`, with recorded-fixture tests
- [ ] `app/api/rooms/lookup/route.ts` and `.../lookup/toc/route.ts`:
      30/min, fails open, 4 s timeout, a day's cache, a descriptive
      User-Agent. The migration already validates `ol_work_key`, `cover_id`
      and `isbn`
- [ ] The create form gets a search box for books with cover thumbnails as a
      plain `<img loading="lazy">`, not `next/image`. When the edition has a
      table of contents, chapters are prefilled. Manual entry still works
      when the lookup fails
- [ ] The room page credits "Book data from Open Library"

## 🟠 23. Sign-in emails hit a site-wide hourly cap

Found 2026-10-26 while testing §14. After a handful of test emails, Supabase
refused to send any more with `over_email_send_rate_limit`. That cap is
**project-wide**: while it holds, no visitor anywhere can get a sign-in email,
so nobody can sign in or create an account. Before §14 the form told them
"wait a minute", which was wrong. It now says the true thing, but saying it
doesn't fix it.

How tight the cap is depends on who sends auth email. Supabase's built-in
mailer allows only a few an hour, can't be raised, and Supabase says not to use
it in production. With custom SMTP the limit is a number under Authentication
→ Rate Limits.

**Answered 2026-10-26: it's the built-in mailer.** Sign-in emails come from
`noreply@mail.app.supabase.io`, so the cap is Supabase's fixed few an hour,
for the whole site, and it can't be raised without custom SMTP.

- [ ] Authentication → Emails → SMTP Settings, sending
      through Resend, which the site already uses for notifications. Use the
      verified domain and Resend's SMTP host, port and API key. Then raise
      the emails-per-hour limit to something a busy evening can't reach
- [ ] Either way, record the setting and the reason in `DECISIONS.md`. It is
      dashboard state, which no file in the repo shows. §20 and §21 both bring
      people to their accounts, so this has to land before either ships

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
