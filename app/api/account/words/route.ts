import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, ensureProfile } from "@/lib/profile";
import { getAdminClient } from "@/lib/supabase";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { isValidWord, normalizeWord } from "@/lib/word-format";
import { MAX_WAITING } from "@/lib/word-queue";

// An account's own proposed words (TODO §20). GET lists them, POST proposes
// one, DELETE withdraws a waiting one. Every query is scoped by the session's
// profile id, never by an id the client sends.
//
// The proposer sees status only: waiting, used or declined. They never see a
// round or a queue position, which is Seb's call from 2026-09-15.

// Ten proposals an hour per IP. This is abuse mitigation and fails open
// (lib/rate-limit.ts). The real cap is the database trigger, which fails
// closed and is what makes "three waiting" exact under a double-click.
const MAX_PROPOSALS = 10;
const WINDOW_SECONDS = 60 * 60;

type Profile = NonNullable<Awaited<ReturnType<typeof ensureProfile>>>;

async function sessionProfile(): Promise<Profile | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const profile = await ensureProfile(user);
  if (!profile) {
    return NextResponse.json({ error: "Profile unavailable. Please try again." }, { status: 500 });
  }
  return profile;
}

export async function GET() {
  const profile = await sessionProfile();
  if (profile instanceof NextResponse) return profile;

  const { data, error } = await getAdminClient()
    .from("word_proposals")
    .select("id, word, status, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Could not load your words." }, { status: 500 });
  return NextResponse.json({ words: data ?? [], maxWaiting: MAX_WAITING });
}

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`word-proposal:${clientIp(req)}`, MAX_PROPOSALS, WINDOW_SECONDS);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "You've proposed several words already. Please try again later.");
  }

  let raw: unknown;
  try {
    ({ word: raw } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isValidWord(raw)) {
    return NextResponse.json(
      {
        error:
          "A word is 2 to 24 letters. It can have an apostrophe or a hyphen inside it, but no spaces or numbers.",
      },
      { status: 400 }
    );
  }
  const word = normalizeWord(raw);

  const profile = await sessionProfile();
  if (profile instanceof NextResponse) return profile;

  const admin = getAdminClient();

  // Read-then-write checks give a clear message in the common case. The
  // trigger and the unique index below are what actually hold under a race.
  const { data: mine } = await admin
    .from("word_proposals")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("status", "waiting");
  if ((mine?.length ?? 0) >= MAX_WAITING) return capReached();

  const { data: used } = await admin.from("words").select("id").eq("word", word).maybeSingle();
  if (used) {
    return NextResponse.json({ error: `"${word}" has already been a word of the month.` }, { status: 409 });
  }

  const { data: created, error } = await admin
    .from("word_proposals")
    .insert({ profile_id: profile.id, word })
    .select("id, word, status, created_at")
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23514" && error.message.includes("word_proposal_cap")) return capReached();
    if (code === "23505") {
      return NextResponse.json({ error: `"${word}" is already waiting in the queue.` }, { status: 409 });
    }
    console.error("Word proposal insert failed:", error.message);
    return NextResponse.json({ error: "Could not save your word. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ word: created }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const profile = await sessionProfile();
  if (profile instanceof NextResponse) return profile;

  // Scoped to waiting as well as to the profile: a used or declined word is a
  // record, not a slot, and cannot be withdrawn. Withdrawing exists because a
  // hard cap of three with no way to take back a typo would leave a slot dead.
  const { data, error } = await getAdminClient()
    .from("word_proposals")
    .delete()
    .eq("id", id)
    .eq("profile_id", profile.id)
    .eq("status", "waiting")
    .select("id");

  if (error) return NextResponse.json({ error: "Could not withdraw that word." }, { status: 500 });
  if (!data || (data as unknown[]).length === 0) {
    return NextResponse.json({ error: "No waiting word with that id." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

function capReached() {
  return NextResponse.json(
    { error: `You have ${MAX_WAITING} words waiting already. Withdraw one, or wait until one is used.` },
    { status: 409 }
  );
}
