import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { getDaysRemaining } from "@/lib/words";
import { notifyDeadline, isDeadlineWindow } from "@/lib/notifications";

// Daily Vercel Cron (see vercel.json). Sends reminders when the current word's
// deadline is exactly 14, 7 or 1 days away; the notification_log claim makes
// reruns on the same day no-ops.
//
// Fails closed: with CRON_SECRET unset, the old check compared against
// "Bearer undefined", which anyone could send.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim() || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = getAdminClient();
  const now = new Date();

  // Current month's word, falling back to the most recent one (mirrors
  // lib/words.getCurrentWord, which uses the anon client).
  const { data: current } = await admin
    .from("words")
    .select("id, word, deadline")
    .eq("month", now.getMonth() + 1)
    .eq("year", now.getFullYear())
    .neq("word", "__long-form__")
    .maybeSingle();

  const word = current ?? null;
  if (!word) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no current word" });
  }

  const days = getDaysRemaining(word.deadline);
  if (!isDeadlineWindow(days)) {
    return NextResponse.json({ ok: true, sent: 0, reason: `deadline in ${days} days` });
  }

  const sent = await notifyDeadline(word, days);
  return NextResponse.json({ ok: true, sent });
}
