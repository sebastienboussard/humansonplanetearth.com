import crypto from "crypto";
import type { NextRequest } from "next/server";

/**
 * Admin session tokens, in one place.
 *
 * The previous scheme was `HMAC(ADMIN_PASSWORD, "hope-admin-session")` — a
 * constant. Every session, on every device, forever, carried the identical
 * cookie value, so a single leaked cookie stayed valid until the password was
 * rotated, and there was no expiry at all. The derivation was also copy-pasted
 * into five files.
 *
 * A token is now `<issuedAtSeconds>.<nonce>.<hmac>`:
 *   - the nonce is 16 random bytes, so two logins never produce the same token
 *   - issuedAt is inside the signed payload, so expiry cannot be edited by the
 *     holder — a tampered timestamp changes the HMAC
 *   - rotating ADMIN_PASSWORD still invalidates every outstanding session
 *
 * This is stateless by choice. Server-side session rows would allow revoking
 * one specific session, but they cost a database round trip on every admin
 * request and a table to keep clean; with a single admin, rotating the password
 * is the revoke-everything button and that is enough.
 */

export const ADMIN_COOKIE = "admin_session";

/** Seven days, matching the cookie's own maxAge. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Tolerance for clock skew between the issuing and verifying instance. */
const FUTURE_SKEW_SECONDS = 60;

function signingKey(): string {
  return process.env.ADMIN_PASSWORD ?? "unset";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", signingKey()).update(payload).digest("hex");
}

/** Constant-time compare of two hex strings of any length. */
function hexEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  // Buffer.from silently drops invalid hex rather than throwing, so a length
  // mismatch is also how malformed input gets rejected.
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** A fresh token for a new login. */
export function issueAdminSessionToken(now: number = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${issuedAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

/** True if the token is well-formed, correctly signed, and not expired. */
export function verifyAdminSessionToken(
  token: string | undefined | null,
  now: number = Date.now()
): boolean {
  if (!token) return false;

  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (!hexEquals(sign(payload), signature)) return false;

  const issuedAt = Number(payload.slice(0, payload.indexOf(".")));
  if (!Number.isFinite(issuedAt)) return false;

  const nowSeconds = Math.floor(now / 1000);
  if (issuedAt > nowSeconds + FUTURE_SKEW_SECONDS) return false;
  return nowSeconds - issuedAt < SESSION_TTL_SECONDS;
}

/** Cookie-based auth check for admin API routes. */
export function isAdminRequest(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

/**
 * Constant-time password check. Both sides are hashed first so the compare
 * operates on equal-length buffers regardless of the submitted length —
 * `timingSafeEqual` throws on a length mismatch, and the mismatch itself would
 * leak the expected length.
 *
 * Realistically network jitter dwarfs the timing delta of a string compare, so
 * this is the smallest of the three fixes here; it is cheap and correct.
 */
export function checkAdminPassword(input: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof input !== "string" || input.length === 0) return false;

  const a = crypto.createHash("sha256").update(expected).digest();
  const b = crypto.createHash("sha256").update(input).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Cookie options for the session cookie, shared by login and logout. */
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;
