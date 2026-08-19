import { NextResponse } from "next/server";
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
    .select("paper_id, papers(id, title, type, status, word_id, submitted_at)")
    .eq("profile_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ papers: data ?? [] });
}
