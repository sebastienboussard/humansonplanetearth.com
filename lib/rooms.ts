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

export type RoomInput = {
  title: string;
  creator: string | null;
  medium: Medium;
  year: number | null;
  intro: string | null;
  sections: SectionInput[];
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
  return { room: { title, creator, medium: payload.medium, year, intro, sections } };
}
