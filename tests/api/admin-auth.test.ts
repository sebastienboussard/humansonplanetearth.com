import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { jsonRequest } from "../helpers/request";
import { expiredAdminSessionToken, legacyAdminSessionToken } from "../helpers/admin";
import { verifyAdminSessionToken, SESSION_TTL_SECONDS } from "@/lib/admin-auth";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import { POST as login } from "@/app/api/admin/login/route";
import { GET as logout } from "@/app/api/admin/logout/route";

const LOGIN_URL = "http://localhost:3000/api/admin/login";

/** Rate-limit store that always allows. */
function allowingStore() {
  return createMockSupabase({
    rpcs: { rate_limit_hit: { data: [{ allowed: true, hits: 1, retry_after: 0 }] } },
  });
}

afterEach(() => {
  holder.current = null;
});

describe("POST /api/admin/login", () => {
  it("rejects a wrong password without setting a cookie", async () => {
    holder.current = allowingStore();
    const res = await login(jsonRequest(LOGIN_URL, { password: "wrong" }));

    expect(res.status).toBe(401);
    expect(res.cookies.get("admin_session")).toBeUndefined();
  });

  it("rejects a missing password", async () => {
    holder.current = allowingStore();
    expect((await login(jsonRequest(LOGIN_URL, {}))).status).toBe(401);
  });

  it("rejects an empty-string password even if ADMIN_PASSWORD were empty", async () => {
    holder.current = allowingStore();
    expect((await login(jsonRequest(LOGIN_URL, { password: "" }))).status).toBe(401);
  });

  it("rejects a non-string password without throwing", async () => {
    holder.current = allowingStore();
    expect((await login(jsonRequest(LOGIN_URL, { password: { $ne: null } }))).status).toBe(401);
  });

  it("sets a httpOnly, verifiable session cookie on success", async () => {
    holder.current = allowingStore();
    const res = await login(jsonRequest(LOGIN_URL, { password: process.env.ADMIN_PASSWORD }));

    expect(res.status).toBe(200);
    const cookie = res.cookies.get("admin_session");
    expect(verifyAdminSessionToken(cookie?.value)).toBe(true);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.maxAge).toBe(SESSION_TTL_SECONDS);
  });

  it("issues a different token for every login", async () => {
    holder.current = allowingStore();
    const first = await login(jsonRequest(LOGIN_URL, { password: process.env.ADMIN_PASSWORD }));
    holder.current = allowingStore();
    const second = await login(jsonRequest(LOGIN_URL, { password: process.env.ADMIN_PASSWORD }));

    // The whole point of the change: a leaked cookie is no longer every session.
    expect(first.cookies.get("admin_session")?.value).not.toBe(
      second.cookies.get("admin_session")?.value
    );
  });

  it("rate-limits repeated attempts by IP", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: [{ allowed: false, hits: 9, retry_after: 420 }] } },
    });

    const res = await login(jsonRequest(LOGIN_URL, { password: "wrong" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("420");
    // Refused before the password is even read.
    expect(holder.current!.rpcCalls[0]?.fn).toBe("rate_limit_hit");
  });

  it("keys the limiter on the forwarded client IP", async () => {
    holder.current = allowingStore();
    await login(
      jsonRequest(
        LOGIN_URL,
        { password: "wrong" },
        { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } }
      )
    );

    expect(holder.current.rpcCalls[0]?.args).toMatchObject({
      p_key: "admin-login:203.0.113.9",
    });
  });
});

describe("admin session tokens", () => {
  it("rejects the old constant-HMAC token", () => {
    // Any cookie minted by the previous scheme must stop working, or the fix
    // would leave the permanent token valid forever.
    expect(verifyAdminSessionToken(legacyAdminSessionToken())).toBe(false);
  });

  it("rejects an expired token", () => {
    expect(verifyAdminSessionToken(expiredAdminSessionToken())).toBe(false);
  });

  it("rejects a token whose timestamp was edited to extend it", () => {
    const expired = expiredAdminSessionToken();
    const [, nonce, sig] = expired.split(".");
    const forged = `${Math.floor(Date.now() / 1000)}.${nonce}.${sig}`;

    expect(verifyAdminSessionToken(forged)).toBe(false);
  });

  it("rejects garbage, empty and undefined values", () => {
    for (const bad of ["", "nonsense", "1.2.3", undefined, null]) {
      expect(verifyAdminSessionToken(bad as string | undefined)).toBe(false);
    }
  });
});

describe("GET /api/admin/logout", () => {
  it("clears the session cookie and redirects to /admin", async () => {
    const res = await logout();

    expect([302, 303, 307, 308]).toContain(res.status);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin");
    const cookie = res.cookies.get("admin_session");
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });
});
