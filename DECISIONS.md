# Decisions

What `CHANGELOG.md` cannot hold. The changelog says what shipped and when;
`TODO.md` says what still needs doing. This file says what was **decided**, what
was **ruled out**, what was **retracted**, what was **corrected**, and what was
**proved against production** — the reasoning that would otherwise be
re-derived, or worse, re-investigated.

Three rules, inherited from `TODO.md`:

- **Nothing here is rewritten to match the present.** Every entry keeps its
  original date and its original claim. A wrong call stays on file with a
  correction beside it, because that is what stops it being made twice.
- **Cite by content, not line number.** Line numbers rot silently; a quoted
  phrase or a function name survives a reformat.
- **Promote before you close.** A ruled-out option, a measurement, or a decision
  that will matter in six months lands here before the job it came from closes —
  not in a plan sheet, which is scratch and gets deleted.

---

## Tripwires — each one already paid for

The six facts that have each cost something. Kept in the repo rather than only
in a working file, so they survive a machine.

- **Migrations are manual and nothing enforces them.** Six tables the code used
  did not exist in production for months; every contact-form message sent in
  that window was lost. `TODO.md` §1a. Still open, and the single most likely
  way to break production again.
- **`@supabase/ssr` hard-codes `flowType: "pkce"`** and spreads it *after* the
  caller's options, so it cannot be overridden. Two consequences:
  `{{ .TokenHash }}` email templates cannot work (use `{{ .ConfirmationURL }}`),
  and magic links only work in the browser that requested them, because the
  verifier lives in that browser's cookie. `app/auth/confirm/route.ts`.
- **`papers` is deliberately author-free.** It carries a public SELECT policy,
  so an author column there would be readable with the anon key. Ownership lives
  in the private `paper_authors` table instead. `supabase/schema.sql`.
- **The storage bucket is public in production** despite `public=false` in the
  schema, so pending and rejected PDFs are readable by anyone who guesses a
  path. `TODO.md` §2, deferred deliberately.
- **`rateLimit` fails open by design.** It sits behind the real checks, and a
  database blip must not close submissions. `lib/rate-limit.ts` explains in a
  comment when that is right and when it is not — the distinction is the point,
  not the default.
- **`getAdminClient()` returns `any`.** There are no generated database types.
  This is how 13 lint errors hid, and how a real nullability mismatch hid behind
  them. Name the row shape; do not annotate a callback `any` to quiet the
  compiler.

---

## Decided

Newest first. A choice that will be questioned again, written down once.

### 2026-10-28 — Open Library: what it gives, and what it doesn't

**Tables of contents are too rare to build on.** The 22 Oct design had the
lookup prefill chapters from an edition's table of contents. Before building
it, `works/<key>/editions.json` was surveyed:

| Work | Editions | With a table of contents (first 100) |
| --- | --- | --- |
| Frankenstein | 2,187 | 0 |
| Pride and Prejudice | 4,042 | 0 |
| The Great Gatsby | 1,181 | 0 |
| Middlemarch | 50 checked | 0 |
| The Lord of the Rings | 253 | 8 |

Even the Tolkien hits are mostly three lines ("pt. 1. The fellowship of the
ring"). The one full one mixes in a list of illustrations and a foreword
among nested books and chapters. **Seb dropped it on 2026-10-28.** The
alternative, offering a usable contents list as an editable suggestion when
one turns up, would rarely appear, and would cost another route and more
requests to Open Library. The "chapters 1 to N" filler already covers most
books.

**What it does give is good enough to fill in, not to trust.** Search
returns the work key, title, authors, first year and cover reliably. But
Middlemarch's first year comes back as 1800, so every field it fills stays
editable. `parseSearch()` skips anything malformed, and the database checks
the key and cover again.

**21b needed a migration after all.** It was said on 2026-10-27 that it
wouldn't. The columns were there from 0005, but `create_room()` and
`request_room()` took no arguments for them. 0009 adds two, defaulting to
null, in the same way 0008 added `p_links`.

**The lookup needs no account.** Asking for a room doesn't, so neither does
the search that helps fill the form in.

**Proved in PGlite.** 0009 reruns cleanly, and leaves one 11-argument
version of each function. Calls in the 0008 style still work. The key and
cover are saved by both functions. A bad key or a cover of 0 is refused,
with nothing left behind. `anon` and `authenticated` get `42501` on the new
signatures.

### 2026-10-27 — Reading Rooms: "Where to find it" links

**Seb asked for both:** links the room's opener adds, and an automatic Open
Library link for books. The first is built. The second needs `ol_work_key`,
which only the §21b lookup fills, so it is specified in §21b. It will be
derived when the page renders, not stored, so it can't go stale and doesn't
use up one of the five.

**A JSON column on `rooms`, not a `room_links` table.** Links are a short
list read only with the room, never queried on their own. A column keeps
them inside the one all-or-nothing call that writes the room. A separate
insert after the call could leave a room without its links.

**Checked twice, because they are rendered as `href`s.** `parseLinks()`
accepts only `http(s)` with a dotted host, and adds `https://` to a bare
address, since that is what people paste. The database repeats the floor
with `room_links_valid()`: an array of at most five `{url}` objects, each
`^https?://` with no whitespace and at most 500 characters. Rooms opened from
an account go live with no review, so this is the only thing between a
pasted `javascript:` and a reader's click.

**Both functions changed signature without a window of breakage.** The old
signatures are dropped and recreated with `p_links jsonb default '[]'`.
Between the migration and the deploy, the old code still calls them with
named arguments and no `p_links`, which the default satisfies. PGlite proved
that call, that no overload is left behind, and that the revokes cover the
new signatures (`42501` for `anon` and `authenticated`).

### 2026-10-27 — Reading Rooms: a page's title is optional

**Seb's call.** The writing is what matters. A required title is one more
thing to think of before a page can be sent. The database keeps the floor:
a title is either absent (null) or real text of 1–200 characters, never
blank. So "no title" has one representation, and the page card simply leaves
the heading out. Migration 0007 replaces the 0005 check rather than editing
0005, which has already run in production.

### 2026-10-27 — Reading Rooms: without an account, ask the admin

**Opening a room still needs an account. Without one, a visitor can ask for
it. Seb's call.** Until now a signed-out visitor at `/rooms/new` got only a
sign-in link. Now they can fill in the same form, and it goes to the admin
instead of going live. Rooms opened from an account still go live at once, so
the 22 Oct "no approval for rooms" holds for accounts. Approval is the price
of skipping the account.

**A request is a room row, not a separate table.** It has status
`'requested'`, and every public policy in 0005 reads `status = 'live'`. So
the room, its sections and its address are invisible before anyone decides,
and the pages route already refuses to write into it. Opening the request
flips one column. A separate table would have needed a copy step that could
fail halfway. The slug is reserved when the request is made, so opening it
later can't collide. Declined rooms are kept, like removed ones.

**The cap is on the queue, not the person.** There is no account to count, so
`request_room()` refuses a 31st waiting request, under an advisory lock, and
fails closed. A flood stops at a queue the admin can still read. The per-IP
limit (3 an hour) sits on top and fails open, as everywhere else. Seb
confirmed 30 once the trade-off was explained: during a flood, real
requests are turned away until the queue is cleared.

**The reply email is optional, private and short-lived.** It goes in
`room_request_contacts`, RLS on and zero policies like the `*_authors`
tables. It is never sent to the browser, even to the admin. It is used for
one email when the request is decided, and then deleted whether or not that
email was sent. That reply has no unsubscribe footer: there is no profile to
sign one against, and it is the only email the person will get.

**Proved in PGlite, as 0005 was.** 0005 ran, then 0006 ran three times
cleanly. Supabase's public roles and default grants were set up first.
Checked:

- `rooms_status_check` is replaced, not doubled, and still refuses an
  unknown status
- a request writes the room, its sections, and the contact row only when an
  email is given, with no author row
- the 31st waiting request is refused with `room_request_cap` / `23514` and
  leaves nothing behind; opening one frees a place
- a taken slug fails with `rooms_slug_key`, which the route retries
- `create_room()` still opens rooms live
- as `anon`: only live rooms are visible, a requested room's sections and
  every reply email are invisible, a request can't be flipped to live, and
  calling `request_room` returns `42501`, as it does for `authenticated`

### 2026-10-26 — Reading Rooms: anyone writes, and room creation is one function

**Pages and margins need no account. Seb's call.** The 22 Oct scope said rooms
need an account but was silent on writing in them. The two options offered:
pages tied to an account, which makes junk traceable to one person, or
anyone, which is the lowest barrier and the same as word papers today. Seb
chose anyone. The cost is a busier approval queue, filtered only by the
honeypot and the per-IP limit. Margins were always going to be open, like comments.

**Room creation is one database function, `create_room()`.** That wasn't in
the 22 Oct sketch. Rooms are author-free, so the creator lives in
`room_authors`, and the cap counts that table. With two separate inserts, a
failure between them would leave a room with no recorded creator, one the cap
could never count. The function locks, counts, inserts the room, the sections
and the author row, and is all or nothing. It is revoked from the public
roles, since otherwise the anon key could call it over PostgREST and skip the
route.

**First built stacked on `turnstile`, then rebuilt on `main`.** The first
version sat on the Turnstile branch so the check would be in from the start.
When Seb ruled Turnstile out the same evening (see "Ruled out"), the Reading
Rooms changes were carried onto a fresh branch from `main` and the check was
taken out. Seb then kept margins as designed, open and instant, over the two
alternatives offered: margins needing an account, or margins waiting for
approval.

**Proved in PGlite, not just unit-tested.** The migration ran twice. Then,
as an `anon` role holding Supabase's default grants:

- only live rooms, approved pages and their margins were visible
- the three author tables were empty to it, with zero policies
- calling `create_room` returned `42501`
- a fourth room within 24h was refused and left nothing behind

The concurrency case is still owed, since PGlite has one connection.

**§10's page was set aside rather than fed from `CHANGELOG.md`,** which the
plan proposed. That file is the engineering record. Shown to readers it would
be the wrong voice for the wrong audience. The question is back with Seb in
§10.

### 2026-10-26 — the emailed code signs in across devices, despite PKCE

§14 was gated on one question: does `{{ .Token }}` from an email requested the
way the app requests it (PKCE, because `@supabase/ssr` forces it) sign anyone
in? The fear came from `token_hash`, which GoTrue refuses for PKCE-issued
emails (see "Retracted and corrected" below).

**Yes, and from anywhere.** The experiment:

- `{{ .Token }}` was added to both templates, under the link, which stays.
- A sign-in email was requested with a PKCE client exactly as `/account`
  requests one. The script confirmed it stored a code verifier, so the request
  really was PKCE.
- `verifyOtp({ email, token, type: "email" })` was called from a *fresh*
  client that held no verifier. That is the cross-device case, the stricter
  of the two tests.
- A session came back for the right user.

PKCE binds the *link* to the requesting browser. It does not bind the
*code*.

**What it settles:**

- The request side doesn't change.
- The server-side implicit-flow fallback that §14 carried is dropped. It
  would have meant moving the request server-side and adding a client
  component to read tokens from the URL fragment.
- The code fixes the cross-device dead end outright. The original plan
  expected it to work only in the tab that asked for it.

**Found on the way:** this project's codes are **8 digits**. §14 had assumed
6 everywhere, which would have rejected every real code.

This is the third time the PKCE hard-coding has shaped a design, after the
`token_hash` retraction and the template rule in `README.md`. This entry
exists so the answer isn't rediscovered a fourth time.

### 2026-10-26 — migrations run before the deploy, not alongside it

§1a had to choose how migrations reach production. Seb's call, from three
options:

| Shape | Why not / why |
| --- | --- |
| **Detect only.** Keep applying by hand, but have CI fail when production is behind | It stops the "silently" without the "by hand". A red X is still a reminder someone has to act on |
| **Migrate alongside the deploy.** An Action runs `db push` while Vercel deploys on its own | It shortens the outage's window without closing it. New code can go live a minute before its schema, which is the original failure, only shorter |
| **Migrate, then deploy.** Chosen | `check → migrate → deploy` on push to `main`, with Vercel's auto-deploy of `main` off. A failed step stops everything after it |

**What it costs.** Vercel no longer decides when production deploys; the
workflow does. That means two secrets to look after, and a deploy of `main`
can't happen without GitHub Actions. Previews are untouched: other branches
still auto-deploy.

**The connection is a URL, not a link.** `db push --db-url` with the
session-pooler string means one secret, no `supabase link`, and nothing
project-specific in `supabase/config.toml`. The CLI is pinned to `2.122.0` in
both the workflow and the README, so the two cannot run different versions.

**`schema.sql` is not the baseline.** It isn't safe to rerun (plain `create
table`, plain `create policy`) and is known to differ from production: it
creates the papers bucket as private, and production's is public. The history
starts at 0001, recorded as applied by hand. A real baseline needs a dump of
production, which this machine has no tools for; §1a carries it.

**Why skipping the repair step would still be safe.** All three existing
migrations are rerunnable: `if not exists`, `create or replace`, and enabling
RLS is idempotent. If production's history were never recorded, the first
push would replay 0001–0003 and change nothing. That property is now a rule
for every new migration, in `README.md`: a rerun must never be what breaks a
deploy.

**One claim is unverified until the first run.** That
`git.deploymentEnabled: { main: false }` in `vercel.json` stops push-triggered
deploys of `main` but not deploy-hook deploys. If it is wrong, the deploy job
goes green and nothing deploys. §1a's checklist says to look for the new
Production deployment, not just the green tick.

### 2026-10-26 — a new running order, and §13 and the hook un-parked

On 2026-09-03 Seb parked §17, §13 and the pre-commit hook. The order then
was: those three parked; §14's experiment and §4a's browser test waiting on a
person; §1a before §20; §9 waiting on its Cloudflare setup.

**Replaced** by an order that follows dependencies, now in `TODO.md`'s header.
Seb un-parked §13 and the hook. §17 stays parked. The reasoning for the new
order:

- **The cheap guards come first.** The hook protects lint at zero. §13 makes
  §9's "an absent secret must reject" true at startup instead of being one
  more thing to retrofit later.
- **§1a still comes before every migration.** §21 now adds a second one.
- **§14 and §9 come before the features.** §20 and §21 are account-only, and
  §21 adds public write routes.

**§13 found more than it was scoped for.** It was written as "a missing var
surfaces late". Writing the check showed that three security checks didn't
just surface late, they *opened*:

- With `ADMIN_PASSWORD` unset, admin sessions were signed with the literal key
  `"unset"`, so anyone reading the source could mint one.
- With `CRON_SECRET` unset, the cron route accepted `Bearer undefined`.
- With `UNSUBSCRIBE_SECRET` unset, unsubscribe links were signed with
  `"unset"` too.

Production had all three set, as the 2026-08-19 probe showed and a re-probe
of the cron route on 2026-10-26 confirmed. So nothing was exposed. All three
now fail closed where they are used, as well as at startup.

**The startup check is proved, not assumed.** A production build started with
a var missing refused to boot. Every request returned 500, and the log listed
each missing var. Started with every var present, it served 200. Next.js
rethrows from `register()` and caches the failure for the instance, which is
why every request fails rather than only the first.

**What the check showed that nobody knew:** `.env.local` has no
`UNSUBSCRIBE_SECRET` and no `CRON_SECRET`. Local `npm run dev` therefore stops
at boot until both are added. That is the check doing its job. No Claude
session will edit that file.

### 2026-09-15 — the word queue is fair by round, and three waiting, not one for life

`TODO.md` §14 planned **one *lifetime* proposal per account**, and said so in the
strongest terms: `word_proposals.profile_id uuid not null unique`, with the note
that "the UNIQUE *is* the cap, enforced in the database rather than the route, so
a double-submit cannot slip two through". It also recorded two deliberate
consequences — that a declined proposal did not return the slot, and that
deleting your account freed it via the cascade.

**Reversed.** An account may hold **three waiting words**, and the queue is
ordered fairly rather than first-come-first-served. The original claim is left
standing above so it is not proposed again as a simplification. The word half of
§14 became §20; §14 keeps its number and is now sign-in codes only.

**Round is computed over waiting rows only, and that is a real trade.** A word's
round is its position among its own author's *waiting* words, oldest first; the
queue sorts by round, then by age. Because the round is derived rather than
stored, a repeat proposer's next word is promoted back to round 1 the moment one
of theirs leaves — so a second word can beat a newcomer's first. The cap of three
is what bounds this: an account can hold at most one round-1 word at a time.

The alternative was a **stored lifetime ordinal** — your Nth word ever is always
round N, whatever happened to the earlier ones. Set aside as harsher than
intended: it charges a round to a word an editor turned down, so being declined
would cost you your place next time. What the chosen design gives up in exchange
is written above rather than discovered later.

Deriving the round also removes a class of problem outright: there is no ordinal
to assign under a race, none to renumber when a row leaves, and none that can
disagree with the rows it describes.

**The cap is a trigger with an advisory lock, not a UNIQUE.** "At most three
waiting" is not expressible as a `UNIQUE`, and a read-then-write count in the
route loses to a double-click — which is exactly the failure §14's UNIQUE was
chosen to prevent, so dropping the UNIQUE without replacing it would have been a
regression. A `before insert` trigger takes
`pg_advisory_xact_lock(hashtext(profile_id))` before counting, which serialises
inserts for that one profile and makes the cap exact.

That check **fails closed**, and the distinction is the point: it *is* the cap,
not abuse mitigation sitting behind a real check, so a database failure must
refuse the fourth word rather than allow it. Contrast the per-IP limiter on the
same route, which may fail open — `lib/rate-limit.ts` carries the rule.

**The admin queue shows no proposer identity.** It returns the word, its round
and its age — no email, no profile id. The admin needs to know the round, not
who wrote it, and nothing else on this site puts a name next to a contribution;
`papers` is deliberately author-free for the same reason.

Nothing here is built. §20 carries the work.

### 2026-09-03 — replies are one level deep, and the server is what enforces it

`comments.parent_comment_id` references `comments(id)`, so the database allows
any depth. The reader has never rendered more than one: `buildTree` keeps only
the children of top-level comments, and Reply is offered on top-level comments
only. Nothing checked, so `POST /api/comments` would happily store a depth-3
comment that no page could display, and would accept a parent belonging to a
different word or paper.

**Decided: one level, enforced in the route.** A reply to a reply is attached to
its top-level ancestor rather than rejected — the person's words stay visible,
which a 400 would not achieve — and a parent from another discussion is refused.
The alternative, full nesting with a recursive render and an indent cap, was
weighed and set aside: deep chains are cramped on a phone, and the flat shape is
what the site has actually been running.

If nesting is ever wanted, this normalisation is the thing to remove, and it is
one block in `app/api/comments/route.ts`.

### 2026-09-03 — the contact and comment limiters fail open, deliberately

Both routes were unthrottled until this date; a honeypot field was the whole
defence, and both send mail. They now use the same Postgres counter as the
upload routes, and they **fail open** for the same reason recorded in
`lib/rate-limit.ts`: if the store is unreachable the request is allowed.

The uncomfortable half, written down rather than glossed: on `/contact` the
limiter is the *only* thing in front of the admin inbox, so failing open means
an attacker who can make the store time out gets an unlimited send — the §3
"fail-open has no floor" problem, now on a second surface. Failing closed was
rejected because a database blip would then silently swallow genuine contact
messages, which is the §1a outage over again, and messages are the one thing
this site cannot afford to drop twice.

The real boundary is Turnstile, and §9's scope was widened to name both routes.
Until it lands, the limiter is mitigation and is commented as such.

---

## Retracted and corrected

Newest first. Each keeps the original claim, not just the fix.

### 2026-10-26 — §22 was 33 advisories, not one

`TODO.md` §22, written the same day, said: "16 findings, 1 critical. **Only
one affects the live site.** `next` 16.2.2 has a denial-of-service bug in
Server Components." That came from a summary that showed only the first two
advisory titles per package.

The full list for `next` alone was **33 advisories: 6 critical**,
including unauthenticated remote code execution through the Image
Optimization API and through `use cache`, plus several proxy/middleware
bypasses, server-side request forgery and cache poisoning. "One
denial-of-service bug" understated it badly. The fix was the same, and so was
the priority, but the record should not have said "only one".

**What the site was actually exposed to,** checked before the upgrade:

- It uses no `next/image`, no `next/og`, no `use cache` and no server
  actions, which rules out most of the critical code paths.
- Every admin API handler checks the session itself, one check per handler,
  so a proxy bypass would have reached at most the admin page's empty shell,
  never its data.
- The `/_next/image` endpoint exists by default even when unused, so the
  image-optimizer advisories can't be fully ruled out.

None of that is a reason to have stayed on 16.2.2. It is what the lesson
costs to know: **read the whole audit, not a summary of it.**

### 2026-10-26 — the plan sheets §15 meant to drain were mostly gone already

`TODO.md` §15 said `~/.claude/plans/` held **8 sheets**, ~73 KB, waiting to be
read for anything unpromoted. When the drain ran on 2026-10-26 there were three.
One was this project's, and two belonged to an unrelated project:
`~/.claude/plans/` is shared by every project on the machine, not just this one.
One of those two disappeared during the drain itself, between listing the
directory and reading it.

- **Reading Rooms (2026-10-22): promoted** to `TODO.md` §21 in full, then
  deleted.
- **The two sheets from the other project:** left alone. They are not this
  repository's to delete.
- **The original eight: not verified.** None of them was still present, so
  nobody can now say whether each was promoted before it went. If a decision
  from before 2026-10-22 seems to be missing from these records, this is the
  likely reason. It is a gap, not proof that anything was lost.

The rule stands, and this is the argument for it: a scratch sheet can vanish
without anyone deciding to delete it. Promote first.

### 2026-08-30 — the former host's name, kept then removed

`CLAUDE.md` and `TODO.md` both recorded that the old host's name in
`CHANGELOG.md` and `doubt-log.md` was **deliberately left**, as a dated record
of what was true then. Reversed the same day: the host was used for two days at
the very start of the project, it appears nowhere in the code, and a name that
shows up only in docs invites the question of whether it is still involved.

The name is gone from the prose in `CHANGELOG.md`, `TODO.md` and the entry
folded in below. Each record kept its substance — what was cleaned up and why.
What still carries the name is the `archive/remove-netlify-config` tag, which
names a live ref on `origin`; rewording it would mean retagging and trading a
working recovery path for a naming preference.

The general rule survives the exception: **do not rewrite a dated record to
match the present.** The *subject* of a record is the author's call; the
substance is not.

### 2026-08-29 — the open-work list said nine sections; ten were open

`TODO.md`'s header omitted §7, which had carried a 🟠 and an open item since it
was reopened for the upload→insert race. Added rather than quietly fixed.

### 2026-08-19 — `token_hash` does not work across devices

A comment in `app/auth/confirm/route.ts` claimed the `token_hash` form of the
magic link "works across devices". It does not, and cannot, while
`@supabase/ssr` forces PKCE — see the tripwire above. The comment was corrected.

Worth stating plainly because it shaped a later design: **there is no
cross-device magic link available** on the current stack. `TODO.md` §14 records
the one experiment that would change that.

### 2026-07-28 — "blank" was actually "transparent", and GPU compositing is back in scope

The failed PDF render on one hardened Firefox profile was first recorded as
**blank/white**. On re-checking it is **transparent** — a see-through hole, the
same as the site embed shows.

That single word had been carrying the entire diagnosis. GPU compositing had
been *ruled out* on the reasoning that "Firefox's own viewer paints white, not a
transparent hole" — i.e. that the two failures looked different and therefore
had different causes. The premise was a mis-observation, so:

- **GPU compositing moves out of "ruled out" and becomes the leading
  hypothesis.**
- The distinction is sharp, and verifiable in the pinned source: pdf.js fills
  the whole canvas opaque white *before* executing any page content —
  `beginDrawing()` does `fillStyle = background || "#ffffff"; fillRect(...)` as
  its first act, and `executeOperatorList` runs only after. So **white** means
  rendering started and drew nothing (a content or font problem), while
  **transparent** means rendering never started at all — no canvas, or a canvas
  that never reached the compositor. Much narrower, and it points away from the
  file and toward the graphics stack.
- The conclusion **"not a site bug" still holds**, and is in fact stronger: the
  failure reproduces with zero site code, in Firefox's own privileged viewer, on
  the raw storage URL.

Open follow-ups are in `TODO.md` §4a.

---

## Ruled out

Recorded so none of these is investigated a second time.

### 2026-10-26 — Cloudflare Turnstile, built and then not shipped

**Ruled out by Seb's call.** `TODO.md` §9 had carried Turnstile since the
start as "the real boundary" on the public forms, behind per-IP limits that
fail open by design. It was built, tested against a fake Cloudflare and proved
against Cloudflare's real siteverify with its test keys (pass, fail, no
token). Then Seb decided not to ship it. No reason is recorded here because
none was given, and none is needed: the site is his.

**What that leaves.** Word and long-form submissions, the contact form,
comments, and Reading Room pages and margins are guarded by a honeypot and a
per-IP limit, and that limit fails open if its store is unreachable. Papers
and Reading Room pages also pass through admin review. Comments and margins do
not: they publish at once. So a spam run on those is cleared after the fact,
not prevented. The comments in `app/api/contact/route.ts` and
`lib/rate-limit.ts` that promised a stronger check behind them were corrected
to say this.

**Kept, not deleted.** The work is the annotated tag `archive/turnstile`, in
this repo's `archive/*` convention: `lib/turnstile.ts` (fails closed on every
path), a hand-written `components/TurnstileWidget.tsx`, the wiring into four
routes and forms, and its tests. If the question comes back, that is the
starting point. Rebuilding it from nothing would not be.

### The blank-render report (2026-07-28)

- **PDF file corruption** — valid xref, embedded `/FontFile2` subset font, a
  59 KB content stream with 1319 text-show operators. The file is well-formed
  byte-for-byte.
- **Supabase storage / CORS** — 200, `application/pdf`,
  `access-control-allow-origin: *`.
- **pdf.js worker asset** — emitted and correctly referenced at
  `/_next/static/media/`.
- **react-pdf ↔ pdfjs-dist version mismatch** — both pinned to 5.4.296.
- **Text/annotation layer CSS** — contains no blend modes or opacity tricks.
- **Firefox fingerprinting protection** — disabling it changed nothing. Note
  this covers Firefox's built-in `resistFingerprinting` **only**, not
  canvas-blocking extensions like CanvasBlocker or NoScript, which stub out
  `getContext("2d")` by a different mechanism and were never tested.
- ~~**GPU compositing** — Firefox's own viewer paints white, not a transparent
  hole~~ — **RETRACTED**, see above. Now the leading hypothesis.

### Security surface (Doubt's review, re-confirmed 2026-07-28)

- **CSRF** — `sameSite=lax` blocks cross-site PATCH/DELETE.
- **SSRF** — no user-supplied URLs are fetched.
- **Content-type spoofing** — `PDFDocument.load` is the real gate, not the MIME
  check. A file that is not a PDF fails to parse regardless of what it claims.

### Rejected fixes

- **An `<object>`/`<iframe>` fallback to the browser's native PDF view** cannot
  be the primary fallback for the transparent-render case. Firefox's native
  viewer *is* pdf.js on a canvas, and it fails identically on the affected
  profile — the fallback would swap one transparent hole for another. Still
  worth having for the general case. The **Download link** is the only path
  verified to work where canvas paint fails, so it is promoted instead
  (`TODO.md` §4).
- **An in-memory `lru-cache` rate-limit fallback**, proposed by the external
  review as the fix for `rateLimit` failing open. Weaker here than it sounds: on
  Vercel each serverless instance has its own memory and concurrent requests
  land on different instances, so a per-instance counter bounds almost nothing.
  The fix that holds is an edge KV store with no fail-open path (`TODO.md` §3).

### External review claims that were wrong (2026-08-29)

An outside review of the repo. Its useful points were filed into `TODO.md` §1a,
§3, §7 and §11; its already-done points needed no entry. Two headline claims
were wrong:

- *"`next: 16.2.2` is likely a typo for `14.2.2` and will break `npm ci`."*
  No — it is the real pinned version, matched by `eslint-config-next@16.2.2`.
  `npm run build`, `tsc --noEmit` and the full test suite all pass on it.
- *"long-form is capped at 4 MB; lower it to 3.5 MB for multipart overhead."*
  Stale. Both routes have shared one `MAX_UPLOAD_SIZE` of 4.5 MB from
  `lib/upload-limits.ts` since 2026-08-20. The overhead risk it describes is
  real and `TODO.md` §3 already records it, along with the mitigation
  (`submitFailureMessage` turns the platform's non-JSON 413 into a size message)
  and the fallback if it bites — drop the one constant to ~4.3 MB.

Its sharpest correct observation was the one already known and least acted on:
manual database migrations caused the §1a outage, and nothing has changed to
stop that recurring.

---

## Verified against production

The method matters as much as the result — it is the part that gets reused.

### 2026-10-26 — the deploy workflow migrated, then deployed, through the hook

The first green run was
[40451211912](https://github.com/sebastienboussard/humansonplanetearth.com/actions/runs/40451211912),
started by hand on commit `cd51547`: check ✅, migrate ✅, deploy ✅. Three
things were proved, each by looking at the result and not the green tick:

- **The history is true.** `migration list` against production, read-only,
  showed 0001–0003 under both Local and Remote. Before the run, the Remote
  column was empty.
- **The hook deploys `main` with auto-deploy off.** Vercel shows `cd51547` as
  the Production deployment. This was the one claim the design rested on that
  nobody had checked, that `git.deploymentEnabled: { main: false }` blocks
  push deploys but not hook deploys. It holds.
- **The site survived it.** It serves 200, and the cron route still rejects
  `Bearer undefined`. That deploy also put the startup env check live, so a
  200 means production has every required var.

**Two failures came first, both fail-closed.** Run `40444461351` was handed an
empty `--db-url`, because no secrets had been added yet. The connection fell
back to a local socket as the runner's own user,
`host=/var/run/postgresql user=runner`, which is how an empty connection string
looks. Run `40449669598` used a password that had been generated but never
applied, and got `28P01 password authentication failed`. Both times the deploy
was skipped and production stayed on the 2026-09-03 build. That is the design
working, not luck.

**What told the two apart** was testing the saved password from a local shell,
read-only, against the same pooler host and user that the CI log printed. The
same `28P01` locally meant the password, not GitHub. A clean list after the
second reset meant the secret, not the database. Testing one link at a time
beat guessing.

### 2026-10-26 — the upload and contact limiters are working live

Six empty POSTs each to `/api/contact` and `/api/submit` on
`humansonplanetearth.com`, from one IP. Both routes returned **400 five times,
then 429**, with `Retry-After: 3598`, and each 429 carried that route's own
message. This is the smoke test `TODO.md` §3 owed for uploads, plus the "sixth
contact message in an hour" check owed since 2026-09-03.

**Why empty bodies prove it.** Both routes call `rateLimit` before they read the
body, so an invalid request still counts toward the limit. The probe exercised
the real limiter path while creating no papers, no messages and no emails.

**Why this is stronger than an absent 429.** The limiter fails open, so a test
that never sees a 429 cannot tell "limiting" apart from "store unreachable".
Seeing a real 429 rules out the second.

**Not covered:** long-form upload (`submit-long-form:`, 3 an hour) and
comments (10 an hour). Both use the same code and the same store, so this is a
gap in what was checked, not a reason to doubt them.

### 2026-08-19 — the orphaned-PDF sweep found nothing, and that is the finding

36 stored PDFs against 39 paths referenced by rows. The gap of 3 is exactly the
rejected papers whose files were removed in the earlier cleanup, and
`scripts/cleanup-rejected-pdfs.mjs` independently reports those same 3 as
already gone. **Two scripts written from opposite directions agree** — one walks
rows and asks storage, the other walks storage and asks rows — which is stronger
evidence than either alone.

The first dry run also earned its keep immediately by catching a bug in the
sweeper itself: Supabase leaves a `.emptyFolderPlaceholder` object in every
folder, which has no paper row by definition and was reported as an orphan. The
sweep now only considers `.pdf` files.

### 2026-08-19 — rate limiting proved through the path the app uses

Migration 0003 verified by three calls against a cap of 2 through PostgREST:
allowed / allowed / denied. Not by reading the migration file, and not through a
different client than the app uses.

Separately confirmed live for the admin-login path — an `admin-login:<ip>` row
with a running counter appeared in `rate_limits` after a post-deploy sign-in, so
the shared store, the `x-forwarded-for` IP derivation and the atomic upsert are
all working. The **upload** path was unexercised until 2026-10-26; see that
entry above.

### 2026-08-19 — secrets proved by probe, not by dashboard

`UNSUBSCRIBE_SECRET` and `CRON_SECRET` confirmed present in Vercel without
reading the dashboard: `Bearer undefined` to the cron route returns 401, which
it would not if the var were unset, and an unsubscribe signature forged with the
`"unset"` fallback key is rejected. A probe tests the running deployment; a
dashboard tests what someone typed into a form.

Migration 0002 (`deadline_14d` / `deadline_7d` / `deadline_1d`) was recorded as
the one true blocker and turned out to be **already applied** — all three
columns return 200 with the migration's defaults. Checking beat assuming, in
both directions.

One thing that *was* wrong: `{{ .SiteURL }}` was still `http://localhost:3000`,
so every emailed link pointed at localhost.

### 2026-08-29 — closed unanswerable: did any contact messages actually get lost?

Whether messages were sent during the §1a outage window can no longer be
established. The only trace would have been Supabase request logs, and retention
is 1 day on free / 7 days on Pro — the window shut well before anyone checked.

Recorded as unanswerable rather than left open, because the real evidence stands
on its own: the `messages` table held **only** the two test rows afterwards, so
nothing was ever stored.

---

## 2026-07-22 — PDF metadata stripping (adversarial review)

Folded in from `doubt-log.md`, which this file replaces. Two review passes over
the metadata-stripping plan and the routes it changed
(`app/api/submit/route.ts`, `app/api/submit/long-form/route.ts`). The goal:
strip identifying metadata from anonymous PDF submissions before storage.

**Strongest counter-argument, pass 1.** pdf-lib's `setAuthor`/`setTitle`/etc.
clear only the Info dictionary. The XMP metadata stream — `/Metadata` on the
catalog, where Word, LaTeX and Acrobat put `dc:creator` — survives untouched, so
a real author name would still leak. The original verification (a pdf-lib
`getAuthor()` check against an Info-dict-only test PDF) was *structurally
incapable* of catching this.

**Strongest counter-argument, pass 2.** `catalog.delete(PDFName.of("Metadata"))`
removes only the *reference*. pdf-lib does not garbage-collect on `save()` — it
writes every object in the context — so the XMP stream persists as an orphaned
object with the name still in the raw bytes. Worse, `exiftool` follows the
reference and reports "clean", making verification a **false PASS**.

The fix, now shipped: also `pdfDoc.context.delete(metaRef)`, and verify with a
raw byte scan rather than exiftool alone.

**Open questions — still live.** These are gaps in the current strip, not
history; `TODO.md` §6 carries the actionable half.

- A **visible byline** in the document body or header is the most common
  deanonymization vector, and no metadata scrub touches it. Human review, or an
  explicit warning to the submitter, is still required before publishing.
- Custom (non-standard) Info-dictionary keys and Word custom document properties
  are not cleared by the six standard setters — residual leak.
- Page-level and image-XObject `/Metadata`, EXIF inside embedded images, and
  annotation `/T` author tags all survive the re-save.
- `save()` defaults to `updateFieldAppearances: true`, which can silently alter
  form rendering — `false` is recommended. Post-save size can also exceed the
  pre-check limit, so the limit is re-checked after the rewrite.
- The plan justified avoiding `exiftool`/`qpdf` by claiming a hosting
  constraint. Unverified; the conclusion holds either way, but the rationale was
  never checked.
