import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_OPTIONS,
  SESSION_TTL_SECONDS,
  checkAdminPassword,
  issueAdminSessionToken,
} from "@/lib/admin-auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Eight attempts per quarter hour per IP. Generous for a human who mistyped,
// useless for a script working through a wordlist.
const MAX_ATTEMPTS = 8;
const WINDOW_SECONDS = 15 * 60;

export async function POST(req: NextRequest) {
  const { allowed, retryAfter } = await rateLimit(
    `admin-login:${clientIp(req)}`,
    MAX_ATTEMPTS,
    WINDOW_SECONDS
  );
  if (!allowed) {
    return tooManyRequests(retryAfter, "Too many attempts. Please try again later.");
  }

  let password: unknown;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, issueAdminSessionToken(), {
    ...ADMIN_COOKIE_OPTIONS,
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
