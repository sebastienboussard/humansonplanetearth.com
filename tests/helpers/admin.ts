import crypto from "crypto";
import { issueAdminSessionToken, SESSION_TTL_SECONDS } from "@/lib/admin-auth";

/**
 * A freshly issued, valid admin session token.
 *
 * Tokens carry a random nonce, so this returns a *different* value on every
 * call — assert with `verifyAdminSessionToken`, never by comparing two tokens.
 */
export function adminSessionToken(): string {
  return issueAdminSessionToken();
}

/** A correctly signed token that has aged past the TTL. */
export function expiredAdminSessionToken(): string {
  return issueAdminSessionToken(Date.now() - (SESSION_TTL_SECONDS + 60) * 1000);
}

/** The old constant-HMAC token this scheme replaced, for regression coverage. */
export function legacyAdminSessionToken(password = process.env.ADMIN_PASSWORD ?? "unset"): string {
  return crypto.createHmac("sha256", password).update("hope-admin-session").digest("hex");
}

/** Cookie map for an authenticated admin request. */
export function adminCookies(): Record<string, string> {
  return { admin_session: adminSessionToken() };
}
