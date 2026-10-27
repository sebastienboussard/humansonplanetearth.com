import { describe, expect, it } from "vitest";
import { assertEnv, envProblems } from "@/lib/env";

/** A complete, valid environment — tests delete or break one var at a time. */
function goodEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: "pk",
    SUPABASE_SECRET_KEY: "sk",
    ADMIN_PASSWORD: "pw",
    UNSUBSCRIBE_SECRET: "us",
    CRON_SECRET: "cs",
    RESEND_API_KEY: "rk",
  };
}

describe("envProblems", () => {
  it("passes a complete environment with the optional vars unset", () => {
    expect(envProblems(goodEnv())).toEqual([]);
  });

  it("passes the test setup's environment", () => {
    // tests/setup.ts mirrors production's shape; if this fails, one of them drifted.
    expect(envProblems()).toEqual([]);
  });

  it.each([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
    "SUPABASE_SECRET_KEY",
    "ADMIN_PASSWORD",
    "UNSUBSCRIBE_SECRET",
    "CRON_SECRET",
    "RESEND_API_KEY",
  ])("reports %s when it is missing", (name) => {
    const env = goodEnv();
    delete env[name];
    expect(envProblems(env)).toEqual([`${name} is missing`]);
  });

  it("treats a whitespace-only value as missing", () => {
    expect(envProblems({ ...goodEnv(), CRON_SECRET: "  \n" })).toEqual(["CRON_SECRET is missing"]);
  });

  it("rejects a Supabase URL that is not http(s)", () => {
    expect(envProblems({ ...goodEnv(), NEXT_PUBLIC_SUPABASE_URL: "test.supabase.co" })).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL is not an http(s) URL",
    ]);
  });

  it("checks an optional URL only for shape, and only when set", () => {
    expect(envProblems({ ...goodEnv(), NEXT_PUBLIC_SITE_URL: "https://example.com" })).toEqual([]);
    expect(envProblems({ ...goodEnv(), NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })).toEqual([
      "NEXT_PUBLIC_SITE_URL is not an http(s) URL",
    ]);
  });
});

describe("assertEnv", () => {
  it("does not throw on a good environment", () => {
    expect(() => assertEnv(goodEnv())).not.toThrow();
  });

  it("lists every problem in one error, so one failed boot shows them all", () => {
    const env = goodEnv();
    delete env.ADMIN_PASSWORD;
    delete env.CRON_SECRET;
    expect(() => assertEnv(env)).toThrow(/ADMIN_PASSWORD is missing[\s\S]*CRON_SECRET is missing/);
  });
});
