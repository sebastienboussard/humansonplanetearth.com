import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { isAdminRequest as isAuthed } from "@/lib/admin-auth";
import { orderWordQueue, type WaitingProposal } from "@/lib/word-queue";

// The admin's view of the word queue (TODO §20). GET returns waiting words in
// fair order, each with its round. PATCH declines one.
//
// No proposer email and no profile id leave this route. The admin needs the
// round, not the identity, and nothing else on this site puts a name next to a
// contribution. orderWordQueue() drops profile_id, and the select below never
// reaches past it into profiles.

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data, error } = await getAdminClient()
    .from("word_proposals")
    .select("id, profile_id, word, created_at")
    .eq("status", "waiting");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ queue: orderWordQueue((data ?? []) as WaitingProposal[]) });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let id: unknown;
  let status: unknown;
  try {
    ({ id, status } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof id !== "string" || status !== "declined") {
    // "used" is set only by POST /api/admin/words, alongside the word it
    // became, so the two can never disagree.
    return NextResponse.json({ error: "Only declining is done here." }, { status: 400 });
  }

  const { data, error } = await getAdminClient()
    .from("word_proposals")
    .update({ status: "declined", decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "waiting")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || (data as unknown[]).length === 0) {
    return NextResponse.json({ error: "That word is no longer waiting." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
