import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { isAdminRequest as isAuthed } from "@/lib/admin-auth";
import { notifyNewWord } from "@/lib/notifications";
import { normalizeWord } from "@/lib/word-format";

// GET — list all words, newest month first, for the admin Words tab
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = getAdminClient();
  const { data: words, error } = await admin
    .from("words")
    .select("id, word, month, year, deadline")
    .neq("word", "__long-form__")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ words: words ?? [] });
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  // proposalId is set when the word came from the queue (TODO §20).
  const { word, month, year, deadline, proposalId } = body as {
    word?: unknown;
    month?: unknown;
    year?: unknown;
    deadline?: unknown;
    proposalId?: unknown;
  };

  if (!word || !month || !year || !deadline) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  const monthNum = parseInt(String(month), 10);
  const yearNum = parseInt(String(year), 10);

  if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
    return NextResponse.json({ error: "Invalid month or year." }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: created, error } = await admin
    .from("words")
    .insert({
      word: normalizeWord(word),
      month: monthNum,
      year: yearNum,
      deadline,
    })
    .select("id, word, deadline")
    .single();

  if (error) {
    // A queued word can be added by hand in the meantime, and that is a real
    // collision, not a server fault.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: `"${normalizeWord(word)}" is already a word.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Marking the proposal used happens here, after the word exists, so the two
  // cannot disagree. Like the notification below, it must never fail word
  // creation: at worst the proposal stays waiting and the admin declines it.
  if (created && typeof proposalId === "string") {
    try {
      const { error: markError } = await admin
        .from("word_proposals")
        .update({ status: "used", used_word_id: created.id, decided_at: new Date().toISOString() })
        .eq("id", proposalId)
        .eq("status", "waiting");
      if (markError) console.error("Marking proposal used failed:", markError.message);
    } catch (err) {
      console.error("Marking proposal used failed:", err);
    }
  }

  // Notification failure must never fail word creation.
  if (created) {
    try {
      await notifyNewWord(created);
    } catch (err) {
      console.error("New-word notification error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
