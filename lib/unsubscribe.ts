import crypto from "crypto";

export const UNSUB_PREFS = [
  "new_word",
  "deadline_reminders",
  "paper_comments",
  "comment_replies",
  "all",
] as const;

export type UnsubPref = (typeof UNSUB_PREFS)[number];

function sign(profileId: string, pref: string): string {
  return crypto
    .createHmac("sha256", process.env.UNSUBSCRIBE_SECRET ?? "unset")
    .update(`${profileId}:${pref}`)
    .digest("hex");
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://humansonplanetearth.com";
}

/** One-click unsubscribe link for a single pref (or "all"); works without login. */
export function unsubscribeUrl(profileId: string, pref: UnsubPref): string {
  const params = new URLSearchParams({ pid: profileId, pref, sig: sign(profileId, pref) });
  return `${siteUrl()}/api/unsubscribe?${params.toString()}`;
}

export function verifyUnsubscribe(pid: string, pref: string, sig: string): boolean {
  if (!UNSUB_PREFS.includes(pref as UnsubPref)) return false;
  const expected = Buffer.from(sign(pid, pref), "hex");
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "hex");
  } catch {
    return false;
  }
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}
