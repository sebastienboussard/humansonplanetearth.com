import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribe } from "@/lib/unsubscribe";
import { getAdminClient } from "@/lib/supabase";

const PREF_LABELS: Record<string, string> = {
  new_word: "new word announcements",
  deadline_reminders: "deadline reminders",
  paper_comments: "comments on your papers",
  comment_replies: "replies to your comments",
  all: "all notifications",
};

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: Georgia, serif; max-width: 32rem; margin: 6rem auto; padding: 0 1.5rem; color: #2f3b2f;">
<h1 style="font-weight: normal;">${title}</h1>
<p style="font-family: system-ui, sans-serif; font-size: 0.9rem; color: #6b6b5e;">${body}</p>
</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

// One-click unsubscribe from email links — no login required, idempotent.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pid = searchParams.get("pid") ?? "";
  const pref = searchParams.get("pref") ?? "";
  const sig = searchParams.get("sig") ?? "";

  if (!pid || !pref || !sig || !verifyUnsubscribe(pid, pref, sig)) {
    return page("Invalid link", "This unsubscribe link is invalid.", 400);
  }

  const updates =
    pref === "all"
      ? {
          new_word: false,
          deadline_reminders: false,
          paper_comments: false,
          comment_replies: false,
        }
      : { [pref]: false };

  const admin = getAdminClient();
  const { error } = await admin
    .from("notification_prefs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("profile_id", pid);

  if (error) {
    return page("Something went wrong", "Please try again later.", 500);
  }

  return page(
    "Unsubscribed",
    `You will no longer receive ${PREF_LABELS[pref]}. You can re-enable them anytime at ${
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://humansonplanetearth.com"
    }/account.`
  );
}
