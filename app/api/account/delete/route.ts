import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/profile";
import { getAdminClient } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

// Deletes the auth user; the profiles.user_id FK cascades to prefs, paper/comment
// links, and the notification log. Papers themselves are untouched — they stay
// published anonymously, just no longer linked to anyone.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = getAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Deletion failed. Please try again." }, { status: 500 });
  }

  const supabase = await createServerSupabase();
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
