import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { getAdminClient } from "@/lib/supabase";

export type Profile = {
  id: string;
  user_id: string;
  email: string;
};

export type NotificationPrefs = {
  new_word: boolean;
  deadline_reminders: boolean;
  deadline_14d: boolean;
  deadline_7d: boolean;
  deadline_1d: boolean;
  paper_comments: boolean;
  comment_replies: boolean;
};

// deadline_14d starts off: it was added after launch, and opting people into a
// reminder they never asked for is the one default that can annoy rather than help.
export const DEFAULT_PREFS: NotificationPrefs = {
  new_word: true,
  deadline_reminders: true,
  deadline_14d: false,
  deadline_7d: true,
  deadline_1d: true,
  paper_comments: true,
  comment_replies: true,
};

/** The signed-in Supabase user for this request, or null. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

/**
 * Fetch the user's profile, lazily creating it (plus default prefs) on
 * first sign-in. Returns null only on backend failure.
 */
export async function ensureProfile(user: User): Promise<Profile | null> {
  const admin = getAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id, user_id, email")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return existing as Profile;

  const { data: created, error } = await admin
    .from("profiles")
    .insert({ user_id: user.id, email: user.email })
    .select("id, user_id, email")
    .single();

  if (error || !created) {
    console.error("Profile creation error:", error);
    return null;
  }

  const { error: prefsErr } = await admin
    .from("notification_prefs")
    .insert({ profile_id: created.id, ...DEFAULT_PREFS });
  if (prefsErr) console.error("Prefs creation error:", prefsErr);

  return created as Profile;
}
