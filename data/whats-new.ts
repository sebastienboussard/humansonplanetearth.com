// Reader-facing "What's new" entries for the home page banner.
//
// This list is ONLY things a visitor would notice: new features, quality-of-life
// improvements, changes to how you use the site. It is deliberately not a
// complete history — security work, refactors, dependency bumps and schema
// changes belong in CHANGELOG.md, which is the full record and is linked from
// the banner for anyone curious enough to want it.
//
// Rule of thumb: if a reader would not notice it while using the site, it does
// not go here. Newest first, edited by hand per release. The planned /changes
// page (TODO §10) is expected to consume this same array.

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
    date: "2026-08-20",
    title: "It was never only writing",
    blurb:
      "A page can be written, drawn, photographed, or anything else.",
    href: "/submit",
  },
  {
    date: "2026-08-19",
    title: "Get notified — Introducing Accounts",
    blurb:
      "Create an account and choose what you want to hear about: a new word announced, a deadline coming up, comments on your papers, replies to your comments. An account only requires your email.  Papers stay anonymous credited only to Human On Planet Earth. This is to encourage discussions and responses. If you do not want an account there is no change. You can still submit without an account.",
    href: "/account",
  },
  {
    date: "2026-08-19",
    title: "Find papers by hashtag",
    blurb:
      "Papers carry quiet hashtags. On word pages and in the long-form index, you can now filter by them.",
  },
  {
    date: "2026-08-19",
    title: "Clearer upload limits",
    blurb:
      "If your PDF is too large, the submit page now tells you straight away — how big it is, what the limit is, and what to do — instead of quietly clearing your file. Both word papers and long-form papers cap at 4.5 MB.",
    href: "/submit",
  },
  {
    date: "2026-07-01",
    title: "Newest papers first",
    blurb:
      "Word pages now open with the most recent paper. A small toggle lets you read oldest-first instead.",
  },
];
