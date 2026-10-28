// Open Library (TODO §21b): find a book when opening a Reading Room, so its
// title, author, year and cover fill themselves in, and the room can link to
// it. Books only; Open Library does not catalogue films.
//
// A convenience, so it fails OPEN: any timeout, error or odd response is "no
// results", and the form still takes the details by hand. What it returns is
// never trusted as-is. parseSearch() keeps only well-formed works, and the
// database checks ol_work_key and cover_id again (migration 0005).
//
// Open Library asks API users to send a User-Agent that names them.

export type OpenLibraryWork = {
  key: string; // "/works/OL20867W"
  title: string;
  author: string | null;
  year: number | null;
  coverId: number | null;
};

const SEARCH_URL = "https://openlibrary.org/search.json";
const FIELDS = "key,title,author_name,first_publish_year,cover_i";
const MAX_RESULTS = 8;
const TIMEOUT_MS = 4000;
const CACHE_SECONDS = 60 * 60 * 24;

export const USER_AGENT = "HumansOnPlanetEarth/1.0 (https://humansonplanetearth.com)";

/** The same pattern the database checks on rooms.ol_work_key. */
export function isWorkKey(value: unknown): value is string {
  return typeof value === "string" && /^\/works\/OL[0-9]+W$/.test(value);
}

/** A cover id the database will accept: a positive integer. */
export function isCoverId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function coverUrl(coverId: number, size: "S" | "M" | "L" = "M"): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/** The work's page on Open Library, which offers borrowing where it can. */
export function workUrl(key: string): string {
  return `https://openlibrary.org${key}`;
}

/**
 * Open Library's search response, reduced to works we can use. Anything
 * malformed is skipped rather than failing the list: a work without a valid
 * key or a title, an author that isn't text, a year outside the column's range.
 */
export function parseSearch(json: unknown): OpenLibraryWork[] {
  const docs = (json as { docs?: unknown } | null)?.docs;
  if (!Array.isArray(docs)) return [];
  const works: OpenLibraryWork[] = [];
  for (const doc of docs as Record<string, unknown>[]) {
    if (!doc || !isWorkKey(doc.key) || typeof doc.title !== "string" || !doc.title.trim()) continue;
    const authors = Array.isArray(doc.author_name)
      ? doc.author_name.filter((a): a is string => typeof a === "string" && a.trim() !== "")
      : [];
    const year = doc.first_publish_year;
    works.push({
      key: doc.key,
      title: doc.title.trim().slice(0, 200),
      author: authors.length ? authors.join(", ").slice(0, 200) : null,
      year: typeof year === "number" && Number.isInteger(year) && year >= -3000 && year <= 2100 ? year : null,
      coverId: isCoverId(doc.cover_i) ? doc.cover_i : null,
    });
    if (works.length === MAX_RESULTS) break;
  }
  return works;
}

/**
 * Search Open Library for books. Throws on a network error, a timeout or a
 * non-2xx response; the route turns that into "unavailable". Responses are
 * cached for a day, so the same search isn't asked twice.
 */
export async function searchWorks(query: string, fetchImpl: typeof fetch = fetch): Promise<OpenLibraryWork[]> {
  const url = `${SEARCH_URL}?${new URLSearchParams({ q: query, fields: FIELDS, limit: String(MAX_RESULTS) })}`;
  const res = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: CACHE_SECONDS },
  } as RequestInit);
  if (!res.ok) throw new Error(`Open Library search returned ${res.status}`);
  return parseSearch(await res.json());
}
