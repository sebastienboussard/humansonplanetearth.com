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
    date: "2026-11-17",
    title: "Easier reading in Reading Rooms",
    blurb:
      "Each part of a room now opens with a numbered list of its pages, so you can see what's there and jump to one. Every page has its own card and a link to the next, and margins fold away until you open them.",
    href: "/rooms",
  },
  {
    date: "2026-10-28",
    title: "Change a paper you sent",
    blurb:
      "Spotted something after sending? If the paper is attached to your account, you can send a new PDF from your account page. It's checked like any submission, and the paper stays as it is until then.",
    href: "/account",
  },
  {
    date: "2026-10-27",
    title: "Reading Rooms",
    blurb:
      "Read a book or watch a film with everyone else, at your own pace. Each room is broken into parts that stay closed until you open them, so nothing ahead of you is spoiled. Write a page about the part you're on, or a few words in the margin. No account? You can still ask for a room to be opened.",
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
];
