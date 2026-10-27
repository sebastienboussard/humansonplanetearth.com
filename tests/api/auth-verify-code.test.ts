import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { jsonRequest, malformedJsonRequest } from "../helpers/request";

// The rate limiter goes through the admin client; the verification goes
// through the cookie-backed server client. Each is mocked on its own.
const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

type VerifyResult = { error: { message: string; status?: number } | null };
const auth = vi.hoisted(() => ({
  verifyOtp: vi.fn(async (): Promise<VerifyResult> => ({ error: null })),
}));
vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: async () => ({ auth }),
}));

import { POST } from "@/app/api/auth/verify-code/route";

const URL = "http://localhost:3000/api/auth/verify-code";
const EMAIL = "reader@example.com";
const CODE = "83700407";

function allowingStore() {
  return createMockSupabase({
    rpcs: { rate_limit_hit: { data: [{ allowed: true, hits: 1, retry_after: 0 }] } },
  });
}

afterEach(() => {
  holder.current = null;
  auth.verifyOtp.mockClear();
  auth.verifyOtp.mockResolvedValue({ error: null });
});

describe("POST /api/auth/verify-code", () => {
  it("signs in with a valid code, as an email OTP", async () => {
    holder.current = allowingStore();
    const res = await POST(jsonRequest(URL, { email: ` ${EMAIL} `, token: CODE }));

    expect(res.status).toBe(200);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: EMAIL, token: CODE, type: "email" });
  });

  it("accepts a code pasted with spaces, the way an email can lay it out", async () => {
    holder.current = allowingStore();
    const res = await POST(jsonRequest(URL, { email: EMAIL, token: "8370 0407" }));

    expect(res.status).toBe(200);
    expect(auth.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ token: CODE }));
  });

  it.each([
    ["six digits — the length the plan first assumed", "837004"],
    ["nine digits", "837004071"],
    ["letters", "8370O407"],
    ["a number, not a string", 83700407],
    ["missing", undefined],
  ])("refuses %s before calling Supabase", async (_label, token) => {
    holder.current = allowingStore();
    const res = await POST(jsonRequest(URL, { email: EMAIL, token }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/8 digits/);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("refuses a missing or oversized email before calling Supabase", async () => {
    holder.current = allowingStore();
    for (const email of [undefined, "", "   ", `${"a".repeat(250)}@x.io`]) {
      expect((await POST(jsonRequest(URL, { email, token: CODE }))).status).toBe(400);
    }
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    holder.current = allowingStore();
    expect((await POST(malformedJsonRequest(URL))).status).toBe(400);
  });

  it("gives one message for wrong, expired and used codes", async () => {
    holder.current = allowingStore();
    auth.verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid", status: 403 } });
    const res = await POST(jsonRequest(URL, { email: EMAIL, token: CODE }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/wrong or has expired/);
  });

  it("passes Supabase's own rate limit through as a 429", async () => {
    holder.current = allowingStore();
    auth.verifyOtp.mockResolvedValue({ error: { message: "rate limited", status: 429 } });
    const res = await POST(jsonRequest(URL, { email: EMAIL, token: CODE }));

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("is rate-limited per forwarded IP, before the body is read", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: [{ allowed: false, hits: 11, retry_after: 300 }] } },
    });
    const res = await POST(
      jsonRequest(URL, { email: EMAIL, token: CODE }, { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } })
    );

    expect(res.status).toBe(429);
    expect(holder.current!.rpcCalls[0]?.args).toMatchObject({ p_key: "verify-code:203.0.113.7" });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});
