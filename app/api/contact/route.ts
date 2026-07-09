import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

const MAX_LEN = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
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

    const admin = getAdminClient();
    const { error } = await admin.from("messages").insert({
      body: trimmed,
      reply_email: email,
    });

    if (error) {
      console.error("Contact insert error:", error);
      return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact route error:", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
