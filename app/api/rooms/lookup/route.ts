import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { searchWorks } from "@/lib/open-library";

// Find a book on Open Library for the open-a-room form (TODO §21b).
// GET ?q=<title or author>: up to 8 works, or { works: [], unavailable: true }
// when Open Library can't be reached. That is a 200 on purpose: the lookup is
// a convenience and fails open, and the form says so and carries on by hand.
//
// No account needed, since asking for a room doesn't need one either. 30 a
// minute per IP keeps a script from spending Open Library's goodwill through
// us; like every limit here it fails open (lib/rate-limit.ts).

const MAX_LOOKUPS = 30;
const WINDOW_SECONDS = 60;

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 200) {
    return NextResponse.json({ error: "Search for at least two characters." }, { status: 400 });
  }

  const limit = await rateLimit(`room-lookup:${clientIp(req)}`, MAX_LOOKUPS, WINDOW_SECONDS);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "That's a lot of searches. Please wait a minute.");
  }

  try {
    return NextResponse.json({ works: await searchWorks(q) });
  } catch (err) {
    console.error("Open Library lookup failed:", err);
    return NextResponse.json({ works: [], unavailable: true });
  }
}
