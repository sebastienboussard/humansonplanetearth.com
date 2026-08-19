import { NextResponse } from "next/server";
import { getSessionUser, ensureProfile, DEFAULT_PREFS } from "@/lib/profile";
import { getAdminClient } from "@/lib/supabase";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const profile = await ensureProfile(user);
  if (!profile) {
    return NextResponse.json({ error: "Profile unavailable. Please try again." }, { status: 500 });
  }

  const admin = getAdminClient();
  const { data: prefs } = await admin
    .from("notification_prefs")
    .select("new_word, deadline_reminders, paper_comments, comment_replies")
    .eq("profile_id", profile.id)
    .maybeSingle();

  // Never expose user_id — profile.id is the only identifier the client sees.
  return NextResponse.json({
    profile: { id: profile.id, email: profile.email },
    prefs: prefs ?? DEFAULT_PREFS,
  });
}
