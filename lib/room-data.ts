import { supabase } from "@/lib/supabase";

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
  created_at: string;
};

export type SectionRow = { id: string; position: number; label: string; kind: "part" | "whole" };

export type RoomPageRow = {
  id: string;
  title: string;
  body: string;
  quote: string | null;
  locator: string | null;
  submitted_at: string;
};

const ROOM_FIELDS = "id, slug, title, creator_name, medium, year, intro, created_at";

export async function listRooms(): Promise<RoomRow[]> {
  const { data } = await supabase
    .from("rooms")
    .select(ROOM_FIELDS)
    .order("created_at", { ascending: false })
    .limit(200);
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

/** Sections are addressed by their place, counting from 1: /rooms/middlemarch/2. */
export function sectionHref(slug: string, section: Pick<SectionRow, "position">): string {
  return `/rooms/${slug}/${section.position + 1}`;
}
