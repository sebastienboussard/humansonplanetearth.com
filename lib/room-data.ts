import { supabase } from "@/lib/supabase";
import { linkLabel, type RoomLink } from "@/lib/rooms";
import { workUrl } from "@/lib/open-library";

// Public reads for the Reading Room pages (TODO §21). Every query goes through
// the public client, so RLS in migration 0005 decides what is visible: live
// rooms, their sections, approved pages and their margins. No query here ever
// touches an *_authors table.

export type RoomRow = {
  id: string;
  slug: string;
  title: string;
  creator_name: string | null;
  medium: string;
  year: number | null;
  intro: string | null;
  links: RoomLink[] | null;
  ol_work_key: string | null;
  cover_id: number | null;
  created_at: string;
};

export type SectionRow = { id: string; position: number; label: string; kind: "part" | "whole" };

export type RoomPageRow = {
  id: string;
  title: string | null;
  body: string;
  quote: string | null;
  locator: string | null;
  submitted_at: string;
};

const ROOM_FIELDS = "id, slug, title, creator_name, medium, year, intro, links, ol_work_key, cover_id, created_at";

/** Newest first. The home page asks for a few; the rooms page for all. */
export async function listRooms(limit = 200): Promise<RoomRow[]> {
  const { data } = await supabase
    .from("rooms")
    .select(ROOM_FIELDS)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as RoomRow[];
}

export async function getRoom(slug: string): Promise<{ room: RoomRow; sections: SectionRow[] } | null> {
  const { data: room } = await supabase.from("rooms").select(ROOM_FIELDS).eq("slug", slug).maybeSingle();
  if (!room) return null;
  const { data: sections } = await supabase
    .from("room_sections")
    .select("id, position, label, kind")
    .eq("room_id", (room as RoomRow).id)
    .order("position", { ascending: true });
  return { room: room as RoomRow, sections: (sections ?? []) as SectionRow[] };
}

/** Approved-page counts per section: ids only, never page text. */
export async function pageCounts(sectionIds: string[]): Promise<Record<string, number>> {
  if (sectionIds.length === 0) return {};
  const { data } = await supabase
    .from("room_pages")
    .select("section_id")
    .in("section_id", sectionIds)
    .eq("status", "approved");
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { section_id: string }[]) {
    counts[row.section_id] = (counts[row.section_id] ?? 0) + 1;
  }
  return counts;
}

export async function sectionPages(sectionId: string): Promise<RoomPageRow[]> {
  const { data } = await supabase
    .from("room_pages")
    .select("id, title, body, quote, locator, submitted_at")
    .eq("section_id", sectionId)
    .eq("status", "approved")
    .order("submitted_at", { ascending: true });
  return (data ?? []) as RoomPageRow[];
}

/** The work, the way it is introduced: "George Eliot · book · 1871". */
export function describeWork(room: Pick<RoomRow, "creator_name" | "medium" | "year">): string {
  return [room.creator_name, room.medium, room.year].filter((x) => x !== null && x !== "").join(" · ");
}

/**
 * "Where to find it": the Open Library work first, when the room has one
 * (§21b), built here rather than stored so it can't go stale or use up one of
 * the five. Then the opener's own links, minus any that repeat it.
 */
export function whereToFind(room: Pick<RoomRow, "links" | "ol_work_key">): { url: string; label: string }[] {
  const auto = room.ol_work_key ? [{ url: workUrl(room.ol_work_key), label: "Open Library" }] : [];
  const own = (room.links ?? [])
    .filter((l) => !auto.some((a) => a.url === l.url))
    .map((l) => ({ url: l.url, label: linkLabel(l.url) }));
  return [...auto, ...own];
}

/** Sections are addressed by their place, counting from 1: /rooms/middlemarch/2. */
export function sectionHref(slug: string, section: Pick<SectionRow, "position">): string {
  return `/rooms/${slug}/${section.position + 1}`;
}
