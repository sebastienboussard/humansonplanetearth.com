import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, supabase } from "@/lib/supabase";
import { ensureProfile, getSessionUser } from "@/lib/profile";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { LIMITS, cleanText } from "@/lib/rooms";

// Margins: short replies under a page in a Reading Room (TODO §21). Anyone may
// write one, and it shows at once, like a comment. Seb's call, 2026-10-26, made
// knowing there is no human check (Turnstile was ruled out, DECISIONS.md). The
// honeypot and the per-IP limit are the only filters, and the limit fails open,
// so spam is handled after the fact. Deleting a margin is an admin job.
//
// Replies are one level deep, enforced here the same way
// app/api/comments/route.ts does it: a reply to a reply attaches to the
// top-level margin, and a parent from another page is refused.

const MAX_MARGINS = 10;
const WINDOW_SECONDS = 60 * 60;

export async function GET(req: NextRequest) {
  const page = new URL(req.url).searchParams.get("page");
  if (!page) return NextResponse.json({ error: "Missing page." }, { status: 400 });

  // The public client, so RLS shows margins only on approved pages in live
  // rooms (migration 0005).
  const { data, error } = await supabase
    .from("room_margins")
    .select("id, body, created_at, parent_id")
    .eq("page_id", page)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Could not load margins." }, { status: 500 });
  return NextResponse.json({ margins: data ?? [] });
}

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`room-margin:${clientIp(req)}`, MAX_MARGINS, WINDOW_SECONDS);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "You've written several margins already. Please try again later.");
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (payload._trap) return NextResponse.json({ ok: true });

  const pageId = cleanText(payload.pageId);
  const body = cleanText(payload.body);
  const parentRequested = cleanText(payload.parentId);
  if (!pageId || !body) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (body.length > LIMITS.margin) {
    return NextResponse.json({ error: `A margin is at most ${LIMITS.margin} characters.` }, { status: 400 });
  }

  const admin = getAdminClient();

  // Margins only go on pages a reader can see: approved, in a live room.
  const { data: page } = await admin
    .from("room_pages")
    .select("id, status, room_sections(rooms(status))")
    .eq("id", pageId)
    .maybeSingle();
  const roomStatus = (page as { room_sections?: { rooms?: { status: string } | null } | null } | null)
    ?.room_sections?.rooms?.status;
  if (!page || (page as { status: string }).status !== "approved" || roomStatus !== "live") {
    return NextResponse.json({ error: "That page isn't open for margins." }, { status: 404 });
  }

  let parentId: string | null = null;
  if (parentRequested) {
    const { data: parent } = await admin
      .from("room_margins")
      .select("id, page_id, parent_id")
      .eq("id", parentRequested)
      .maybeSingle();
    if (!parent) return NextResponse.json({ error: "That margin no longer exists." }, { status: 400 });
    if (parent.page_id !== pageId) {
      return NextResponse.json({ error: "That margin belongs to a different page." }, { status: 400 });
    }
    parentId = parent.parent_id ?? parent.id;
  }

  const { data: margin, error } = await admin
    .from("room_margins")
    .insert({ page_id: pageId, parent_id: parentId, body })
    .select("id, body, created_at, parent_id")
    .single();
  if (error || !margin) {
    console.error("Margin insert failed:", error?.message);
    return NextResponse.json({ error: "Could not save your margin. Please try again." }, { status: 500 });
  }

  // Optional, private, and never allowed to fail the margin.
  try {
    const user = await getSessionUser();
    const profile = user ? await ensureProfile(user) : null;
    if (profile) {
      const { error: linkError } = await admin
        .from("room_margin_authors")
        .insert({ margin_id: margin.id, profile_id: profile.id });
      if (linkError) console.error("Margin author link failed:", linkError.message);
    }
  } catch (err) {
    console.error("Margin author link failed:", err);
  }

  return NextResponse.json({ margin }, { status: 201 });
}
