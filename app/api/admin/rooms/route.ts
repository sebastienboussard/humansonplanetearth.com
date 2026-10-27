import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { isAdminRequest as isAuthed } from "@/lib/admin-auth";

// The admin's Reading Rooms tab (TODO §21).
//   GET: pages waiting for review, with their room and section; live rooms.
//   PATCH { pageId, status: "approved" | "rejected" }: decide a page.
//   DELETE { roomId }: take a room down. It is marked removed, not deleted,
//   so it 404s publicly but the record stays.
//
// No author data leaves here either. The admin decides on the writing, not on
// who wrote it, and no query below touches an *_authors table.

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = getAdminClient();

  const [pages, rooms] = await Promise.all([
    admin
      .from("room_pages")
      .select("id, title, body, quote, locator, submitted_at, room_sections(label, rooms(title, slug))")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true }),
    admin
      .from("rooms")
      .select("id, slug, title, medium, created_at")
      .eq("status", "live")
      .order("created_at", { ascending: false }),
  ]);

  if (pages.error || rooms.error) {
    return NextResponse.json({ error: (pages.error ?? rooms.error)!.message }, { status: 500 });
  }
  return NextResponse.json({ pendingPages: pages.data ?? [], liveRooms: rooms.data ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let pageId: unknown;
  let status: unknown;
  try {
    ({ pageId, status } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof pageId !== "string" || (status !== "approved" && status !== "rejected")) {
    return NextResponse.json({ error: "Expected a pageId and approved or rejected." }, { status: 400 });
  }

  const { data, error } = await getAdminClient()
    .from("room_pages")
    .update({ status })
    .eq("id", pageId)
    .eq("status", "pending")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || (data as unknown[]).length === 0) {
    return NextResponse.json({ error: "That page has already been decided." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let roomId: unknown;
  try {
    ({ roomId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof roomId !== "string") return NextResponse.json({ error: "Missing roomId." }, { status: 400 });

  const { data, error } = await getAdminClient()
    .from("rooms")
    .update({ status: "removed" })
    .eq("id", roomId)
    .eq("status", "live")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || (data as unknown[]).length === 0) {
    return NextResponse.json({ error: "That room isn't live." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
