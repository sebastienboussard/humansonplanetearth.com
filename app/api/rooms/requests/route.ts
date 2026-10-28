import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { notifyAdminRoomRequest } from "@/lib/admin-alerts";
import { parseRoom, slugWithSuffix, slugify } from "@/lib/rooms";

// Ask for a Reading Room without an account (TODO §21). Seb's call,
// 2026-10-27: opening a room needs an account, but anyone can ask the admin to
// open one. The request is a hidden room (status 'requested', migration 0006)
// that only goes live when the admin opens it, and that decision is the real
// check. request_room() caps the waiting queue at 30, failing closed. This
// per-IP limit and the honeypot only keep the queue from flooding, and the
// limit fails open (lib/rate-limit.ts).
//
// The reply email is optional, stored privately, and never returned.

const MAX_REQUESTS = 3;
const WINDOW_SECONDS = 60 * 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`room-request:${clientIp(req)}`, MAX_REQUESTS, WINDOW_SECONDS);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "You've asked for several rooms already. Please try again later.");
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (payload._trap) return NextResponse.json({ ok: true });

  const parsed = parseRoom(payload);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { room } = parsed;

  let email: string | null = null;
  if (typeof payload.reply_email === "string" && payload.reply_email.trim() !== "") {
    email = payload.reply_email.trim();
    if (!EMAIL_RE.test(email) || email.length > 320) {
      return NextResponse.json({ error: "Please enter a valid email, or leave it empty." }, { status: 400 });
    }
  }

  const admin = getAdminClient();
  const base = slugify(room.title);
  // The address is reserved now, so opening the request later can't collide.
  for (const slug of [base, slugWithSuffix(base)]) {
    const { error } = await admin.rpc("request_room", {
      p_slug: slug,
      p_title: room.title,
      p_creator_name: room.creator,
      p_medium: room.medium,
      p_year: room.year,
      p_intro: room.intro,
      p_sections: room.sections,
      p_links: room.links,
      p_reply_email: email,
    });
    if (!error) {
      await notifyAdminRoomRequest({ title: room.title });
      return NextResponse.json({ ok: true, status: "requested" }, { status: 201 });
    }

    const code = (error as { code?: string }).code;
    if (code === "23505" && error.message.includes("rooms_slug_key")) continue;
    if (code === "23514" && error.message.includes("room_request_cap")) {
      return NextResponse.json(
        { error: "There are a lot of room requests waiting just now. Please try again in a few days." },
        { status: 409 }
      );
    }
    console.error("request_room failed:", error.message);
    return NextResponse.json({ error: "Could not send your request. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ error: "Could not send your request. Please try again." }, { status: 500 });
}
