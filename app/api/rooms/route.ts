import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { ensureProfile, getSessionUser } from "@/lib/profile";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  LIMITS,
  buildSections,
  cleanText,
  cleanYear,
  isMedium,
  sectionsProblem,
  slugWithSuffix,
  slugify,
} from "@/lib/rooms";

// Open a Reading Room (TODO §21). Needs a signed-in account, Seb's call. The
// room goes live at once, with no approval queue. Abuse control is the account
// requirement, the cap of three rooms per account per 24 hours inside
// create_room() (migration 0005), which fails closed, this per-IP limit, which
// fails open, and the admin Remove action.

const MAX_CREATES = 5;
const WINDOW_SECONDS = 60 * 60;

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`room-create:${clientIp(req)}`, MAX_CREATES, WINDOW_SECONDS);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "You've opened several rooms already. Please try again later.");
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (payload._trap) return NextResponse.json({ ok: true });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to open a room." }, { status: 401 });

  const title = cleanText(payload.title);
  const creator = cleanText(payload.creator);
  const intro = cleanText(payload.intro);
  if (!title) return NextResponse.json({ error: "Give the work a title." }, { status: 400 });
  if (title.length > LIMITS.title || (creator?.length ?? 0) > LIMITS.creator) {
    return NextResponse.json({ error: "The title or creator is too long." }, { status: 400 });
  }
  if ((intro?.length ?? 0) > LIMITS.intro) {
    return NextResponse.json({ error: `The introduction is at most ${LIMITS.intro} characters.` }, { status: 400 });
  }
  if (!isMedium(payload.medium)) {
    return NextResponse.json({ error: "Choose what kind of work this is." }, { status: 400 });
  }
  const year = cleanYear(payload.year);
  if (payload.year !== undefined && payload.year !== null && payload.year !== "" && year === null) {
    return NextResponse.json({ error: "The year should be a whole number." }, { status: 400 });
  }
  const sections = buildSections(payload.sections);
  const problem = sectionsProblem(sections);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const profile = await ensureProfile(user);
  if (!profile) {
    return NextResponse.json({ error: "Profile unavailable. Please try again." }, { status: 500 });
  }

  const admin = getAdminClient();
  const base = slugify(title);
  // Try the plain slug first, then once with a suffix if another room has it.
  for (const slug of [base, slugWithSuffix(base)]) {
    const { error } = await admin.rpc("create_room", {
      p_profile_id: profile.id,
      p_slug: slug,
      p_title: title,
      p_creator_name: creator,
      p_medium: payload.medium,
      p_year: year,
      p_intro: intro,
      p_sections: sections,
    });
    if (!error) return NextResponse.json({ slug }, { status: 201 });

    const code = (error as { code?: string }).code;
    if (code === "23505" && error.message.includes("rooms_slug_key")) continue;
    if (code === "23514" && error.message.includes("room_cap")) {
      return NextResponse.json(
        { error: "You've opened three rooms in the last day. You can open another tomorrow." },
        { status: 409 }
      );
    }
    console.error("create_room failed:", error.message);
    return NextResponse.json({ error: "Could not open the room. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ error: "Could not find a free address for this room. Please try again." }, { status: 500 });
}
