// Reader-facing "What's new" entries for the home page banner.
//
// This list is ONLY things a visitor would notice: new features, quality-of-life
// improvements, changes to how you use the site. It is deliberately not a
// complete history — security work, refactors, dependency bumps and schema
// changes belong in CHANGELOG.md, which is the full record and is linked from
// the banner for anyone curious enough to want it.
//
// Rule of thumb: if a reader would not notice it while using the site, it does
// not go here. Newest first, edited by hand per release.
//
// At most MAX_WHATS_NEW entries, Seb's call 2026-10-26, so the banner stays
// short and only carries what is actually new. Adding an entry means dropping
// the oldest, and a test enforces it. Dropped entries are not lost: each one
// is in CHANGELOG.md. That also means the planned /changes page (TODO §10)
// can't use this array for the full history.

/** The public repository. The site's code is open — say so where readers look. */
export const REPO_URL = "https://github.com/sebastienboussard/humansonplanetearth.com";
export const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;

export const MAX_WHATS_NEW = 5;

export type WhatsNewEntry = {
  date: string; // ISO "YYYY-MM-DD"
  title: string;
  blurb: string;
  href?: string; // optional "see it" link
};

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    date: "2026-10-26",
    title: "Reading Rooms",
    blurb:
      "Read a book or watch a film with everyone else, at your own pace. Each room is broken into parts that stay closed until you open them, so nothing ahead of you is spoiled. Write a page about the part you're on, or a few words in the margin.",
    href: "/rooms",
  },
  {
    date: "2026-10-26",
    title: "Suggest a word",
    blurb:
      "Signed in? You can now propose a word for a future month, from your account page. Everyone's first suggestion is considered before anyone's second.",
    href: "/account",
  },
  {
    date: "2026-10-26",
    title: "Sign in with a code, on any device",
    blurb:
      "The sign-in email now has a code as well as a link. Asked for it on your laptop but opened the email on your phone? Type the code into the page you started on and you're in.",
    href: "/account",
  },
  {
    date: "2026-09-03",
    title: "A new word now points at the month before",
    blurb:
      "In the first days of a month there is nothing published yet. The page no longer stops at \u201cbe the first\u201d \u2014 it links you to what people made for last month's word.",
    href: "/words",
  },
  {
    date: "2026-09-03",
    title: "Comments follow the paper you are looking at",
    blurb:
      "Paging quickly through papers could leave the previous paper's discussion on screen. Each paper now keeps its own thread, however fast you move.",
  },
];
