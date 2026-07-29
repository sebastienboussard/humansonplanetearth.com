import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, ensureProfile } from "@/lib/profile";
import { getAdminClient } from "@/lib/supabase";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const profile = await ensureProfile(user);
  if (!profile) {
    return NextResponse.json({ error: "Profile unavailable. Please try again." }, { status: 500 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("paper_authors")
    .select("paper_id, public_visible, papers(id, title, type, status, word_id, submitted_at)")
    .eq("profile_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ papers: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { paperId?: unknown; publicVisible?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { paperId, publicVisible } = body;
  if (typeof paperId !== "string" || typeof publicVisible !== "boolean") {
    return NextResponse.json({ error: "paperId and publicVisible required." }, { status: 400 });
  }

  const profile = await ensureProfile(user);
  if (!profile) {
    return NextResponse.json({ error: "Profile unavailable. Please try again." }, { status: 500 });
  }

  // Ownership guard: the profile filter ensures you can only toggle your own papers.
  const admin = getAdminClient();
  const { error } = await admin
    .from("paper_authors")
    .update({ public_visible: publicVisible })
    .eq("paper_id", paperId)
    .eq("profile_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
