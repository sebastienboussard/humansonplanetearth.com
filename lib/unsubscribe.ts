import crypto from "crypto";

export const UNSUB_PREFS = [
  "new_word",
  "deadline_reminders",
  "paper_comments",
  "comment_replies",
  "all",
] as const;

export type UnsubPref = (typeof UNSUB_PREFS)[number];

/**
 * **Fails closed.** This used to fall back to the literal `"unset"`, so with
 * the secret missing anyone could forge a link that unsubscribes anyone. Now
 * a missing secret returns null: no link is signed and none verifies.
 * `lib/env.ts` also refuses to boot without it. Trimmed only to test presence;
 * the secret is used byte for byte, so links already in inboxes keep working.
 */
function sign(profileId: string, pref: string): string | null {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret?.trim()) return null;
  return crypto.createHmac("sha256", secret).update(`${profileId}:${pref}`).digest("hex");
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://humansonplanetearth.com";
}

/**
 * One-click unsubscribe link for a single pref (or "all"); works without login.
 * Throws without the secret: an email with a dead unsubscribe link should not
 * go out. Every sender in `lib/notifications.ts` catches and logs.
 */
export function unsubscribeUrl(profileId: string, pref: UnsubPref): string {
  const sig = sign(profileId, pref);
  if (!sig) throw new Error("UNSUBSCRIBE_SECRET is not set; refusing to build an unsubscribe link");
  const params = new URLSearchParams({ pid: profileId, pref, sig });
  return `${siteUrl()}/api/unsubscribe?${params.toString()}`;
}

export function verifyUnsubscribe(pid: string, pref: string, sig: string): boolean {
  if (!UNSUB_PREFS.includes(pref as UnsubPref)) return false;
  const signature = sign(pid, pref);
  if (!signature) return false;
  const expected = Buffer.from(signature, "hex");
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "hex");
  } catch {
    return false;
  }
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}
