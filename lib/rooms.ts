import { isCoverId, isWorkKey } from "@/lib/open-library";

// Reading Rooms (TODO §21): the rules every room, section, page and margin
// follows. Pure and Supabase-free, so the create form, the routes and the
// tests all use one definition. Each limit here is also a CHECK in
// supabase/migrations/0005_reading_rooms.sql (a page's title since 0007),
// which is the floor if a route ever forgets.

export const MEDIUMS = ["book", "film", "series", "play", "other"] as const;
export type Medium = (typeof MEDIUMS)[number];

export const LIMITS = {
  title: 200,
  creator: 200,
  intro: 2000,
  label: 120,
  sections: 60,
  pageTitle: 200,
  pageBody: 10000,
  quote: 300,
  locator: 40,
  margin: 2000,
  links: 5,
  linkUrl: 500,
} as const;

/** The label of the closing section every room gets. */
export const WHOLE_WORK_LABEL = "The whole work";

/**
 * A URL slug from a title: lowercase ASCII words joined by hyphens, at most 60
 * characters so a collision suffix still fits the 80-character column.
 * Accents are folded (É → e); anything else non-alphanumeric is a separator.
 * Falls back to "room" for a title with no usable characters, such as one
 * written entirely in a non-Latin script.
 */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "room";
}

/** A short random suffix for when a slug is taken: "middlemarch-k3x9". */
export function slugWithSuffix(base: string, random: () => number = Math.random): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o, 1/l
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(random() * alphabet.length)];
  return `${base}-${suffix}`;
}

export type SectionInput = { label: string; kind: "part" | "whole" };

/**
 * The creator's labels, trimmed and with blanks dropped, followed by "The
 * whole work". It is always present and always last, whatever the client
 * sends. A room broken into nothing is just the whole work.
 */
export function buildSections(labels: unknown): SectionInput[] {
  const parts = (Array.isArray(labels) ? labels : [])
    .map((l) => (typeof l === "string" ? l.trim() : ""))
    .filter((l) => l.length > 0)
    .map((label) => ({ label, kind: "part" as const }));
  return [...parts, { label: WHOLE_WORK_LABEL, kind: "whole" }];
}

/** Null when acceptable; otherwise a message a person can act on. */
export function sectionsProblem(sections: SectionInput[]): string | null {
  const parts = sections.filter((s) => s.kind === "part");
  if (parts.length > LIMITS.sections) return `A room can have at most ${LIMITS.sections} sections.`;
  const long = parts.find((s) => s.label.length > LIMITS.label);
  if (long) return `Section names are at most ${LIMITS.label} characters.`;
  return null;
}

/** Trimmed string, or null when blank or not a string. */
export function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** A year as an integer within the column's range, or null. */
export function cleanYear(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  return Number.isInteger(n) && n >= -3000 && n <= 2100 ? n : null;
}

export function isMedium(value: unknown): value is Medium {
  return typeof value === "string" && (MEDIUMS as readonly string[]).includes(value);
}

export type RoomLink = { url: string };

/**
 * "Where to find it" links (migration 0008), one per line or as an array.
 * Blanks are dropped and repeats collapsed. Only http(s) URLs, so nothing like
 * javascript: can reach the room page; the database checks the same. A bare
 * "openlibrary.org/..." gets https:// in front, since that is what people paste.
 */
export function parseLinks(input: unknown): { links: RoomLink[] } | { error: string } {
  const lines = (Array.isArray(input) ? input : typeof input === "string" ? input.split("\n") : [])
    .map((l) => (typeof l === "string" ? l.trim() : ""))
    .filter((l) => l.length > 0);
  const links: RoomLink[] = [];
  for (const line of lines) {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(line) ? line : `https://${line}`;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      return { error: `"${line.slice(0, 60)}" doesn't look like a web address.` };
    }
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) {
      return { error: `"${line.slice(0, 60)}" doesn't look like a web address.` };
    }
    const href = url.toString();
    if (href.length > LIMITS.linkUrl) return { error: `A link is at most ${LIMITS.linkUrl} characters.` };
    if (!links.some((l) => l.url === href)) links.push({ url: href });
  }
  if (links.length > LIMITS.links) return { error: `A room can list at most ${LIMITS.links} links.` };
  return { links };
}

/** What a link shows as: its site, without "www.". */
export function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export type RoomInput = {
  title: string;
  creator: string | null;
  medium: Medium;
  year: number | null;
  intro: string | null;
  sections: SectionInput[];
  links: RoomLink[];
  /** From the Open Library lookup (§21b); books only, otherwise null. */
  olWorkKey: string | null;
  coverId: number | null;
};

/**
 * A room as the create form sends it, checked. Shared by opening a room and
 * requesting one, so the two can't drift apart. The error is a message a
 * person can act on.
 */
export function parseRoom(payload: Record<string, unknown>): { room: RoomInput } | { error: string } {
  const title = cleanText(payload.title);
  const creator = cleanText(payload.creator);
  const intro = cleanText(payload.intro);
  if (!title) return { error: "Give the work a title." };
  if (title.length > LIMITS.title || (creator?.length ?? 0) > LIMITS.creator) {
    return { error: "The title or creator is too long." };
  }
  if ((intro?.length ?? 0) > LIMITS.intro) {
    return { error: `The introduction is at most ${LIMITS.intro} characters.` };
  }
  if (!isMedium(payload.medium)) return { error: "Choose what kind of work this is." };
  const year = cleanYear(payload.year);
  if (payload.year !== undefined && payload.year !== null && payload.year !== "" && year === null) {
    return { error: "The year should be a whole number." };
  }
  const sections = buildSections(payload.sections);
  const problem = sectionsProblem(sections);
  if (problem) return { error: problem };
  const links = parseLinks(payload.links);
  if ("error" in links) return links;
  // Only a book can be an Open Library work. Anything that isn't exactly the
  // shape the database accepts is dropped, not refused: the lookup is a
  // convenience, and a room without it is still a good room.
  const isBook = payload.medium === "book";
  const olWorkKey = isBook && isWorkKey(payload.ol_work_key) ? payload.ol_work_key : null;
  const coverId = olWorkKey && isCoverId(payload.cover_id) ? payload.cover_id : null;
  return {
    room: { title, creator, medium: payload.medium, year, intro, sections, links: links.links, olWorkKey, coverId },
  };
}
