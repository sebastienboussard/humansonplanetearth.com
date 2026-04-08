import { NextRequest, NextResponse } from "next/server";

// TODO: connect Supabase after setup
// GET: fetch comments for ?wordId=... or ?paperId=...
// POST: create a comment { wordId, paperId?, parentCommentId?, body }

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ comments: [] });
  }

  const { searchParams } = new URL(req.url);
  const wordId = searchParams.get("wordId");
  const paperId = searchParams.get("paperId");

  if (!wordId) {
    return NextResponse.json({ error: "wordId required." }, { status: 400 });
  }

  // TODO: query Supabase comments table
  void paperId;
  return NextResponse.json({ comments: [] });
}

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json(
      { error: "Comments not yet available." },
      { status: 503 }
    );
  }

  try {
    const { wordId, paperId, parentCommentId, body } = await req.json();

    if (!wordId || !body?.trim()) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // TODO: rate limit by IP (max 10/hour)
    // TODO: honeypot check
    // TODO: insert into Supabase comments table
    void paperId;
    void parentCommentId;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
