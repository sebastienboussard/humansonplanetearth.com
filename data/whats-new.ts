// Reader-facing "What's new" entries for the home page banner.
// Newest first, edited by hand per release. Keep entries written for readers —
// "you can now filter papers by hashtag", not a dev changelog. The planned
// /changes page (TODO §10) is expected to consume this same array.

/** The public repository. The site's code is open — say so where readers look. */
export const REPO_URL = "https://github.com/sebastienboussard/humansonplanetearth.com";
export const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;

export type WhatsNewEntry = {
  date: string; // ISO "YYYY-MM-DD"
  title: string;
  blurb: string;
  href?: string; // optional "see it" link
};

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    date: "2026-08-19",
    title: "Accounts, still anonymous",
    blurb:
      "You can now make an account — no name required — to be emailed when a new word arrives, when a deadline nears, or when someone replies to your comment. Papers are still credited only to Human On Planet Earth.",
    href: "/account",
  },
  {
    date: "2026-08-19",
    title: "Find papers by hashtag",
    blurb:
      "Papers carry quiet hashtags. On word pages and in the long-form index, you can now filter by them.",
  },
  {
    date: "2026-07-01",
    title: "Newest papers first",
    blurb:
      "Word pages now open with the most recent paper. A small toggle lets you read oldest-first instead.",
  },
];
