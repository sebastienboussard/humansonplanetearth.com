import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { isAdminRequest as isAuthed } from "@/lib/admin-auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Manually attach an existing (old) paper to a profile. Always private —
// attachments are an internal log with no public surface.
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: { paperId?: unknown; profileId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { paperId, profileId } = body;
  if (
    typeof paperId !== "string" ||
    typeof profileId !== "string" ||
    !UUID_RE.test(paperId) ||
    !UUID_RE.test(profileId)
  ) {
    return NextResponse.json({ error: "paperId and profileId (uuids) required." }, { status: 400 });
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from("paper_authors")
    .upsert(
      { paper_id: paperId, profile_id: profileId, public_visible: false },
      { onConflict: "paper_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
