import { describe, expect, it } from "vitest";
import { unsubscribeUrl, verifyUnsubscribe, UNSUB_PREFS } from "@/lib/unsubscribe";

const PROFILE = "11111111-2222-3333-4444-555555555555";

function parse(url: string) {
  const u = new URL(url);
  return {
    pid: u.searchParams.get("pid")!,
    pref: u.searchParams.get("pref")!,
    sig: u.searchParams.get("sig")!,
  };
}

describe("unsubscribe tokens", () => {
  it("round-trips for every pref", () => {
    for (const pref of UNSUB_PREFS) {
      const { pid, pref: p, sig } = parse(unsubscribeUrl(PROFILE, pref));
      expect(verifyUnsubscribe(pid, p, sig)).toBe(true);
    }
  });

  it("points at the unsubscribe API on the configured site", () => {
    const url = unsubscribeUrl(PROFILE, "new_word");
    expect(url).toContain(`${process.env.NEXT_PUBLIC_SITE_URL}/api/unsubscribe?`);
  });

  it("rejects a signature for a different profile", () => {
    const { pref, sig } = parse(unsubscribeUrl(PROFILE, "new_word"));
    expect(verifyUnsubscribe("99999999-8888-7777-6666-555555555555", pref, sig)).toBe(false);
  });

  it("rejects a signature for a different pref", () => {
    const { pid, sig } = parse(unsubscribeUrl(PROFILE, "new_word"));
    expect(verifyUnsubscribe(pid, "all", sig)).toBe(false);
  });

  it("rejects unknown prefs even with a matching signature scheme", () => {
    expect(verifyUnsubscribe(PROFILE, "everything", "00")).toBe(false);
  });

  it("rejects malformed signatures without throwing", () => {
    expect(verifyUnsubscribe(PROFILE, "new_word", "")).toBe(false);
    expect(verifyUnsubscribe(PROFILE, "new_word", "zz-not-hex")).toBe(false);
    expect(verifyUnsubscribe(PROFILE, "new_word", "abcd")).toBe(false);
  });
});
