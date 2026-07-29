import { NextRequest, NextResponse } from "next/server";
import { supabase, getAdminClient } from "@/lib/supabase";
import { getSessionUser, ensureProfile } from "@/lib/profile";
import { notifyPaperComment, notifyCommentReply } from "@/lib/notifications";

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

    // Optional authorship: recorded server-side from the session (never from the
    // client) and only in the private comment_authors table — comments render
    // anonymously everywhere regardless. Failures never fail the comment.
    let authorProfileId: string | null = null;
    try {
      const user = await getSessionUser();
      if (user) {
        const profile = await ensureProfile(user);
        if (profile) {
          authorProfileId = profile.id;
          const { error: authorErr } = await admin
            .from("comment_authors")
            .insert({ comment_id: comment.id, profile_id: profile.id });
          if (authorErr) console.error("Comment author insert error:", authorErr);
        }
      }
    } catch (err) {
      console.error("Comment author error:", err);
    }

    try {
      if (paperId) await notifyPaperComment(paperId, comment, authorProfileId);
      if (parentCommentId) {
        await notifyCommentReply(parentCommentId, comment, wordId, paperId ?? null, authorProfileId);
      }
    } catch (err) {
      console.error("Comment notification error:", err);
    }

    return NextResponse.json({ comment });
  } catch {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
