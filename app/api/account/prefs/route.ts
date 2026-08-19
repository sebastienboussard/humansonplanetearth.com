import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, ensureProfile } from "@/lib/profile";
import { getAdminClient } from "@/lib/supabase";

const PREF_KEYS = [
  "new_word",
  "deadline_reminders",
  "deadline_14d",
  "deadline_7d",
  "deadline_1d",
  "paper_comments",
  "comment_replies",
] as const;

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!PREF_KEYS.includes(key as (typeof PREF_KEYS)[number])) {
      return NextResponse.json({ error: `Unknown preference: ${key}` }, { status: 400 });
    }
    if (typeof value !== "boolean") {
      return NextResponse.json({ error: `Preference ${key} must be true or false.` }, { status: 400 });
    }
    updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No preferences provided." }, { status: 400 });
  }

  const profile = await ensureProfile(user);
  if (!profile) {
    return NextResponse.json({ error: "Profile unavailable. Please try again." }, { status: 500 });
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from("notification_prefs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("profile_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
