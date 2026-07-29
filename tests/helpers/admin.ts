import crypto from "crypto";

/** Mirrors the session-token derivation in the admin API routes. */
export function adminSessionToken(password = process.env.ADMIN_PASSWORD ?? "unset"): string {
  return crypto.createHmac("sha256", password).update("hope-admin-session").digest("hex");
}

/** Cookie map for an authenticated admin request. */
export function adminCookies(): Record<string, string> {
  return { admin_session: adminSessionToken() };
}
