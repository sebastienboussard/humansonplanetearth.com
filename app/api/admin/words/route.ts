import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { isAdminRequest as isAuthed } from "@/lib/admin-auth";
import { notifyNewWord } from "@/lib/notifications";

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

  const { word, month, year, deadline } = await req.json();

  if (!word || !month || !year || !deadline) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
    return NextResponse.json({ error: "Invalid month or year." }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: created, error } = await admin
    .from("words")
    .insert({
      word: word.toLowerCase().trim(),
      month: monthNum,
      year: yearNum,
      deadline,
    })
    .select("id, word, deadline")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
