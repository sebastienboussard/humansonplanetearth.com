import { NextRequest, NextResponse } from "next/server";
import { supabase, getAdminClient } from "@/lib/supabase";
import { getSessionUser, ensureProfile } from "@/lib/profile";
import { notifyPaperComment, notifyCommentReply } from "@/lib/notifications";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Ten comments an hour per IP — more than any reader writes, nothing like what
// a script writes. Comments are public-insert by RLS and a reply can trigger a
// notification email, so before this the honeypot was the whole defence.
// Fails open for the same reason as the other limiters: it sits in front of
// email and a comments table, not in front of a security boundary. See §20.
const MAX_COMMENTS = 10;
const WINDOW_SECONDS = 60 * 60;

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
    const limit = await rateLimit(`comment:${clientIp(req)}`, MAX_COMMENTS, WINDOW_SECONDS);
    if (!limit.allowed) {
      return tooManyRequests(
        limit.retryAfter,
        "You have posted several comments already. Please try again later."
      );
    }

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

    // Replies are one level deep, and this is where that is decided. The
    // column allows any depth and the reader only renders children of a
    // top-level comment, so a reply to a reply would be stored where nobody
    // can read it. Attaching it to the top-level ancestor keeps it visible
    // rather than rejecting the person's words. The UI offers Reply on
    // top-level comments only; this closes the same hole for direct posts.
    let parentId: string | null = null;
    if (parentCommentId) {
      const { data: parent } = await admin
        .from("comments")
        .select("id, word_id, paper_id, parent_comment_id")
        .eq("id", parentCommentId)
        .maybeSingle();

      if (!parent) {
        return NextResponse.json(
          { error: "That comment no longer exists." },
          { status: 400 }
        );
      }
      // A parent from another word or another paper would render nowhere.
      if (parent.word_id !== wordId || (parent.paper_id ?? null) !== (paperId ?? null)) {
        return NextResponse.json(
          { error: "That comment belongs to a different discussion." },
          { status: 400 }
        );
      }
      parentId = parent.parent_comment_id ?? parent.id;
    }

    const { data: comment, error } = await admin
      .from("comments")
      .insert({
        word_id: wordId,
        paper_id: paperId ?? null,
        parent_comment_id: parentId,
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
      // Notify the parent the comment was actually attached to, which is the
      // top-level ancestor when someone replied to a reply.
      if (parentId) {
        await notifyCommentReply(parentId, comment, wordId, paperId ?? null, authorProfileId);
      }
    } catch (err) {
      console.error("Comment notification error:", err);
    }

    return NextResponse.json({ comment });
  } catch {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
