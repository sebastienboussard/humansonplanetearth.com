import { NextRequest, NextResponse } from "next/server";
import { supabase, getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wordId = searchParams.get("wordId");
  const paperId = searchParams.get("paperId");

  if (!wordId) {
    return NextResponse.json({ error: "wordId required." }, { status: 400 });
  }

  let query = supabase
    .from("comments")
    .select("id, body, created_at, parent_comment_id")
    .eq("word_id", wordId)
    .order("created_at", { ascending: true });

  if (paperId) {
    query = query.eq("paper_id", paperId);
  } else {
    query = query.is("paper_id", null);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const { wordId, paperId, parentCommentId, body, _trap } = await req.json();

    // Honeypot
    if (_trap) return NextResponse.json({ ok: true });

    if (!wordId || !body?.trim()) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (body.trim().length > 2000) {
      return NextResponse.json({ error: "Comment too long (2000 characters max)." }, { status: 400 });
    }

    // Use admin client to bypass RLS on insert
    const admin = getAdminClient();

    const { data: comment, error } = await admin
      .from("comments")
      .insert({
        word_id: wordId,
        paper_id: paperId ?? null,
        parent_comment_id: parentCommentId ?? null,
        body: body.trim(),
      })
      .select("id, body, created_at, parent_comment_id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ comment });
  } catch {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
