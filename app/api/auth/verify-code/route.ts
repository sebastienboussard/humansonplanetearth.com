import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { OTP_LENGTH, isValidCode, normalizeCode } from "@/lib/sign-in-code";

// Sign-in by the code in the email, as an alternative to the link (TODO §14).
//
// The link only works in the browser that requested it, because @supabase/ssr
// forces PKCE and the link is exchanged against a verifier cookie (see
// app/auth/confirm/route.ts). The code is not bound that way: verifyOtp with
// the plain token signs in from any client, including one that never asked for
// the email. That was proved on 2026-10-26 (DECISIONS.md), and it is what lets
// someone request on a laptop and finish on a phone.
//
// Verifying through the cookie-backed server client means the session lands in
// exactly the cookies /auth/confirm would have set.

// Ten tries per quarter hour per IP: plenty for a human mistyping a code from
// another screen. This limiter fails open (lib/rate-limit.ts), so it is not the
// boundary against brute force. The boundary is the 8-digit keyspace, the
// code's expiry, and Supabase's own rate limit on verification. That limit is
// per IP, and the IP Supabase sees here is this server's, so it caps code
// attempts across the whole site. One person hammering this route can make
// codes fail for everyone for a while. The emailed link still works when that
// happens, and the error says to wait.
const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

const WRONG_CODE = "That code is wrong or has expired. Check the email, or request a new one.";

export async function POST(req: NextRequest) {
  const { allowed, retryAfter } = await rateLimit(
    `verify-code:${clientIp(req)}`,
    MAX_ATTEMPTS,
    WINDOW_SECONDS
  );
  if (!allowed) {
    return tooManyRequests(retryAfter, "Too many attempts. Please wait a few minutes and try again.");
  }

  let email: unknown;
  let token: unknown;
  try {
    ({ email, token } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof email !== "string" || !email.trim() || email.length > 254) {
    return NextResponse.json({ error: "Enter the email you signed in with." }, { status: 400 });
  }
  // Anything that is not exactly OTP_LENGTH digits is refused here, before
  // Supabase sees it.
  if (!isValidCode(token)) {
    return NextResponse.json(
      { error: `The code is ${OTP_LENGTH} digits. Check the email and try again.` },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: normalizeCode(token),
    type: "email",
  });

  if (error) {
    if (error.status === 429) {
      return tooManyRequests(60, "Too many attempts. Please wait a minute and try again.");
    }
    // Wrong, expired and already-used all look the same to the reader, and
    // should: telling them apart would only help someone guessing.
    console.error("Sign-in code verification failed:", error.message);
    return NextResponse.json({ error: WRONG_CODE }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
