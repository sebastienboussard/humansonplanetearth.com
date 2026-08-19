import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

function req(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/submit", { headers: new Headers(headers) });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  holder.current = null;
  vi.restoreAllMocks();
});

describe("clientIp", () => {
  it("takes the left-most entry of x-forwarded-for", () => {
    // The chain is client → proxy → proxy; the original client is first.
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9, 70.0.0.1, 10.0.0.1" }))).toBe(
      "203.0.113.9"
    );
  });

  it("trims whitespace", () => {
    expect(clientIp(req({ "x-forwarded-for": "  203.0.113.9  " }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("falls back to a constant when no proxy header is present", () => {
    // NextRequest.ip is never populated on Vercel, so this is the real default
    // for a direct hit. Everyone shares one bucket, which is the safe direction.
    expect(clientIp(req())).toBe("unknown");
  });

  it("ignores an empty x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "", "x-real-ip": "198.51.100.4" }))).toBe(
      "198.51.100.4"
    );
  });
});

describe("rateLimit", () => {
  it("passes key, max and window through to the atomic rpc", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: [{ allowed: true, hits: 2, retry_after: 100 }] } },
    });

    const result = await rateLimit("submit:1.2.3.4", 5, 3600);

    expect(result).toEqual({ allowed: true, retryAfter: 100 });
    expect(holder.current.rpcCalls[0]).toEqual({
      fn: "rate_limit_hit",
      args: { p_key: "submit:1.2.3.4", p_max: 5, p_window_seconds: 3600 },
    });
  });

  it("denies when the store says the window is exhausted", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: [{ allowed: false, hits: 6, retry_after: 2400 }] } },
    });

    expect(await rateLimit("k", 5, 3600)).toEqual({ allowed: false, retryAfter: 2400 });
  });

  it("accepts a bare object as well as a single-row array", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: { allowed: false, hits: 6, retry_after: 60 } } },
    });

    expect((await rateLimit("k", 5, 3600)).allowed).toBe(false);
  });

  it("fails open when the rpc errors", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { error: { message: "function does not exist" } } },
    });

    // Deliberate: a missing migration or a database blip must not take
    // submissions offline. The limiter sits behind the real checks.
    expect(await rateLimit("k", 5, 3600)).toEqual({ allowed: true, retryAfter: 0 });
    expect(console.error).toHaveBeenCalled();
  });

  it("fails open when the rpc returns no row", async () => {
    holder.current = createMockSupabase({ rpcs: {} });
    expect((await rateLimit("k", 5, 3600)).allowed).toBe(true);
  });

  it("fails open when the client itself throws", async () => {
    holder.current = createMockSupabase();
    holder.current.rpc.mockRejectedValueOnce(new Error("network down"));

    expect((await rateLimit("k", 5, 3600)).allowed).toBe(true);
  });
});

describe("tooManyRequests", () => {
  it("returns 429 with a Retry-After header", async () => {
    const res = tooManyRequests(90, "Slow down.");

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("90");
    expect(await res.json()).toEqual({ error: "Slow down." });
  });

  it("never emits Retry-After: 0, which clients read as retry immediately", () => {
    expect(tooManyRequests(0, "Slow down.").headers.get("retry-after")).toBe("1");
  });
});
