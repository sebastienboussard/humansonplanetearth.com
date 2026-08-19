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
    // Must list every column the account dashboard renders. Omitting the three
    // deadline windows made them load as unchecked whatever was stored — and
    // since they default to true in the database, the page claimed reminders
    // were off while they were still being sent.
    .select(
      "new_word, deadline_reminders, deadline_14d, deadline_7d, deadline_1d, paper_comments, comment_replies"
    )
    .eq("profile_id", profile.id)
    .maybeSingle();

  // Never expose user_id — profile.id is the only identifier the client sees.
  return NextResponse.json({
    profile: { id: profile.id, email: profile.email },
    prefs: prefs ?? DEFAULT_PREFS,
  });
}
