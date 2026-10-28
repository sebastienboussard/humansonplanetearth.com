import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, supabase } from "@/lib/supabase";
import { ensureProfile, getSessionUser } from "@/lib/profile";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { notifyAdminNewRoomPage } from "@/lib/admin-alerts";
import { LIMITS, cleanText } from "@/lib/rooms";

// Pages in a Reading Room (TODO §21).
//
// GET ?section=<id>: a section's approved pages, read through the public
// client so RLS decides what is visible (migration 0005). The room page loads
// these only when a reader opens a section, so no page text sits in the HTML
// for anyone to skim past a spoiler.
//
// POST: anyone may write a page, no account needed (Seb's call, 2026-10-26).
// It waits for review like a paper, and that review is the real check: there
// is no human check in front of it (Turnstile was ruled out, DECISIONS.md).
// The honeypot and the per-IP limit only keep the queue from flooding. If the writer is signed in, a private
// link is kept in room_page_authors and never shown.

const MAX_PAGES = 5;
const WINDOW_SECONDS = 60 * 60;

export async function GET(req: NextRequest) {
  const section = new URL(req.url).searchParams.get("section");
  if (!section) return NextResponse.json({ error: "Missing section." }, { status: 400 });

  const { data, error } = await supabase
    .from("room_pages")
    .select("id, title, body, quote, locator, submitted_at")
    .eq("section_id", section)
    .eq("status", "approved")
    .order("submitted_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Could not load pages." }, { status: 500 });
  return NextResponse.json({ pages: data ?? [] });
}

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`room-page:${clientIp(req)}`, MAX_PAGES, WINDOW_SECONDS);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "You've written several pages already. Please try again later.");
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (payload._trap) return NextResponse.json({ ok: true });

  const sectionId = cleanText(payload.sectionId);
  const title = cleanText(payload.title);
  const body = cleanText(payload.body);
  const quote = cleanText(payload.quote);
  const locator = cleanText(payload.locator);
  // The title is optional (migration 0007); the writing isn't.
  if (!sectionId || !body) {
    return NextResponse.json({ error: "A page needs some writing." }, { status: 400 });
  }
  if ((title?.length ?? 0) > LIMITS.pageTitle) {
    return NextResponse.json({ error: `The title is at most ${LIMITS.pageTitle} characters.` }, { status: 400 });
  }
  if (body.length > LIMITS.pageBody) {
    return NextResponse.json({ error: `A page is at most ${LIMITS.pageBody} characters.` }, { status: 400 });
  }
  if ((quote?.length ?? 0) > LIMITS.quote || (locator?.length ?? 0) > LIMITS.locator) {
    return NextResponse.json(
      { error: `A quotation is at most ${LIMITS.quote} characters, and its page or time at most ${LIMITS.locator}.` },
      { status: 400 }
    );
  }

  const admin = getAdminClient();
  const { data: section } = await admin
    .from("room_sections")
    .select("id, label, rooms(title, status)")
    .eq("id", sectionId)
    .maybeSingle();
  const room = (section as { rooms?: { title: string; status: string } | null } | null)?.rooms;
  if (!section || !room || room.status !== "live") {
    return NextResponse.json({ error: "That room or section isn't open." }, { status: 404 });
  }

  const { data: page, error } = await admin
    .from("room_pages")
    .insert({ section_id: sectionId, title, body, quote, locator })
    .select("id")
    .single();
  if (error || !page) {
    console.error("Room page insert failed:", error?.message);
    return NextResponse.json({ error: "Could not save your page. Please try again." }, { status: 500 });
  }

  // Optional, private, and never allowed to fail the page.
  try {
    const user = await getSessionUser();
    const profile = user ? await ensureProfile(user) : null;
    if (profile) {
      const { error: linkError } = await admin
        .from("room_page_authors")
        .insert({ page_id: page.id, profile_id: profile.id });
      if (linkError) console.error("Room page author link failed:", linkError.message);
    }
  } catch (err) {
    console.error("Room page author link failed:", err);
  }

  await notifyAdminNewRoomPage({ room: room.title, section: (section as { label: string }).label });

  return NextResponse.json({ ok: true, status: "pending" }, { status: 201 });
}
