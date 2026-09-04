import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { notifyAdminNewMessage } from "@/lib/admin-alerts";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const MAX_LEN = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Five messages an hour per IP. Until this was added the honeypot was the only
// thing between a script and the admin inbox — and every accepted message sends
// mail through Resend before it is stored, so an unthrottled endpoint spends
// someone else's sending reputation as well as filling a table.
//
// Fails open, like the upload limiter and for the same reason: a database blip
// must not silently swallow genuine messages, which is the §1a failure over
// again. The real boundary here is Turnstile (§9), whose scope now includes
// this route.
const MAX_MESSAGES = 5;
const WINDOW_SECONDS = 60 * 60;

export async function POST(req: NextRequest) {
  try {
    const limit = await rateLimit(`contact:${clientIp(req)}`, MAX_MESSAGES, WINDOW_SECONDS);
    if (!limit.allowed) {
      return tooManyRequests(
        limit.retryAfter,
        "You have sent several messages already. Please try again later."
      );
    }

    const { body, reply_email, _trap } = await req.json();

    // Bot check
    if (_trap) {
      return NextResponse.json({ ok: true });
    }

    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!trimmed) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }
    if (trimmed.length > MAX_LEN) {
      return NextResponse.json(
        { error: `Message must be under ${MAX_LEN} characters.` },
        { status: 400 }
      );
    }

    let email: string | null = null;
    if (reply_email != null && typeof reply_email === "string" && reply_email.trim() !== "") {
      const e = reply_email.trim();
      if (!EMAIL_RE.test(e)) {
        return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
      }
      email = e;
    }

    // Email the admin inbox before touching the database. The email carries
    // the full body and reply address, so if the insert fails afterwards the
    // message has still genuinely reached a human. (The production `messages`
    // table has been missing before — TODO §1a — and messages were lost.)
    let emailed = false;
    try {
      emailed = await notifyAdminNewMessage({ body: trimmed, replyEmail: email });
    } catch (err) {
      console.error("Admin message alert error:", err);
    }

    const admin = getAdminClient();
    const { error } = await admin.from("messages").insert({
      body: trimmed,
      reply_email: email,
    });

    if (error) {
      console.error("Contact insert error:", error);
      if (!emailed) {
        return NextResponse.json(
          { error: "Submission failed. Please try again." },
          { status: 500 }
        );
      }
      // The insert failed but the email was delivered — the message got
      // through, so don't tell the visitor otherwise. Logged loudly above.
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact route error:", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
