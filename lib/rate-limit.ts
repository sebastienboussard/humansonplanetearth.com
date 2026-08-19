import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

/**
 * Caller IP. `NextRequest.ip` is not populated on Vercel, so the proxy headers
 * are the only source. `x-forwarded-for` is a client-to-origin chain and the
 * left-most entry is the original client — Vercel appends the real peer, so the
 * value cannot be trivially spoofed past it, but treat this as best-effort:
 * it is abuse mitigation, not an authentication signal.
 */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitResult = { allowed: boolean; retryAfter: number };

/**
 * Records one hit and reports whether it is allowed. Backed by the
 * `rate_limit_hit` Postgres function (migration 0003) so the count is shared
 * across lambda instances and atomic under concurrency.
 *
 * **Fails open.** If the store is unreachable the request is allowed and the
 * failure is logged. That is deliberate: this limiter is abuse mitigation
 * layered *behind* the real checks — the admin password is still required on
 * login, and uploads are still validated and size-capped. Failing closed would
 * turn a database blip into a total outage of submissions, and would have
 * locked the site down completely during the window when this migration had
 * not been applied yet. Contrast §9 (Turnstile), which must fail closed
 * because there the check *is* the security boundary.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const { data, error } = await getAdminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("rate_limit_hit returned no row");

    return {
      allowed: row.allowed !== false,
      retryAfter: Number(row.retry_after) || windowSeconds,
    };
  } catch (err) {
    console.error(`Rate limit check failed for ${key} — allowing request:`, err);
    return { allowed: true, retryAfter: 0 };
  }
}

/** 429 with a Retry-After header, so clients and crawlers back off properly. */
export function tooManyRequests(retryAfter: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "retry-after": String(Math.max(1, retryAfter)) } }
  );
}
