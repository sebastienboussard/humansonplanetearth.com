// Hashtags are stored as normalized metadata on papers. They are never
// rendered on the page — they exist only to power the search-box filter.

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;

// Normalize a single token into a bare tag: strip a leading "#", lowercase,
// and keep only letters, digits, hyphens and underscores. Returns "" if
// nothing usable remains.
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, MAX_TAG_LENGTH);
}

// Parse a free-form string ("#quiet, memory  grief") into a clean, deduped
// list of tags. Splits on whitespace and commas.
export function parseTags(input: string | null | undefined): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of input.split(/[\s,]+/)) {
    const tag = normalizeTag(token);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
      if (out.length >= MAX_TAGS) break;
    }
  }
  return out;
}

// Does a paper's tags match a search query? The query is split into terms the
// same way tags are parsed, and each term is matched as a substring against
// the paper's tags — so "quiet" finds "#quietmornings", and "quiet memory"
// finds papers tagged with either. An empty query matches everything.
export function matchesTagQuery(tags: string[] | null | undefined, query: string): boolean {
  const terms = query.split(/[\s,]+/).map(normalizeTag).filter(Boolean);
  if (terms.length === 0) return true;
  const list = tags ?? [];
  return terms.some((q) => list.some((t) => t.includes(q)));
}
