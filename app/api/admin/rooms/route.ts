import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { isAdminRequest as isAuthed } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import { roomRequestDeclinedEmail, roomRequestOpenedEmail } from "@/lib/email-templates";

// The admin's Reading Rooms tab (TODO §21).
//   GET: pages waiting for review, with their room and section; room
//   requests from visitors without an account (migration 0006); live rooms.
//   PATCH { pageId, status: "approved" | "rejected" }: decide a page.
//   PATCH { roomId, decision: "open" | "decline" }: decide a room request.
//   DELETE { roomId }: take a room down. It is marked removed, not deleted,
//   so it 404s publicly but the record stays.
//
// No author data leaves here either. The admin decides on the writing, not on
// who wrote it, and no query below touches an *_authors table. A requester's
// reply email is read only to send the one reply, then deleted, and is never
// sent to the browser.

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = getAdminClient();

  const [pages, requests, rooms] = await Promise.all([
    admin
      .from("room_pages")
      .select("id, title, body, quote, locator, submitted_at, room_sections(label, rooms(title, slug))")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true }),
    admin
      .from("rooms")
      .select("id, slug, title, creator_name, medium, year, intro, links, created_at, room_sections(label, position)")
      .eq("status", "requested")
      .order("created_at", { ascending: true }),
    admin
      .from("rooms")
      .select("id, slug, title, medium, created_at")
      .eq("status", "live")
      .order("created_at", { ascending: false }),
  ]);

  const failed = pages.error ?? requests.error ?? rooms.error;
  if (failed) return NextResponse.json({ error: failed.message }, { status: 500 });
  return NextResponse.json({
    pendingPages: pages.data ?? [],
    roomRequests: requests.data ?? [],
    liveRooms: rooms.data ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let pageId: unknown;
  let status: unknown;
  let roomId: unknown;
  let decision: unknown;
  try {
    ({ pageId, status, roomId, decision } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (roomId !== undefined) return decideRequest(roomId, decision);
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

async function decideRequest(roomId: unknown, decision: unknown) {
  if (typeof roomId !== "string" || (decision !== "open" && decision !== "decline")) {
    return NextResponse.json({ error: "Expected a roomId and open or decline." }, { status: 400 });
  }
  const admin = getAdminClient();

  // Opening dates the room from today, so it lands at the top of the list.
  const change = decision === "open" ? { status: "live", created_at: new Date().toISOString() } : { status: "declined" };
  const { data, error } = await admin
    .from("rooms")
    .update(change)
    .eq("id", roomId)
    .eq("status", "requested")
    .select("id, slug, title");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const room = (data as { id: string; slug: string; title: string }[] | null)?.[0];
  if (!room) return NextResponse.json({ error: "That request has already been decided." }, { status: 404 });

  // The reply is best-effort: the decision above stands whether or not it
  // sends. The address is deleted either way, since it was kept for this only.
  try {
    const { data: contact } = await admin
      .from("room_request_contacts")
      .select("email")
      .eq("room_id", room.id)
      .maybeSingle();
    const email = (contact as { email?: string } | null)?.email;
    if (email) {
      const content = decision === "open" ? roomRequestOpenedEmail(room) : roomRequestDeclinedEmail(room);
      await sendEmail({ to: email, ...content });
    }
  } catch (err) {
    console.error("Room request reply failed:", err);
  }
  const { error: deleteError } = await admin.from("room_request_contacts").delete().eq("room_id", room.id);
  if (deleteError) console.error("Room request contact delete failed:", deleteError.message);

  return NextResponse.json({ ok: true, slug: decision === "open" ? room.slug : undefined });
}
