import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { getRequest } from "../helpers/request";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);
vi.mock("@/lib/open-library", async (original) => ({
  ...(await original<typeof import("@/lib/open-library")>()),
  searchWorks: vi.fn(),
}));

import { GET } from "@/app/api/rooms/lookup/route";
import { searchWorks } from "@/lib/open-library";

const URL = "http://localhost:3000/api/rooms/lookup";
const allow = { data: [{ allowed: true, hits: 1, retry_after: 0 }] };
const work = { key: "/works/OL20867W", title: "Middlemarch", author: "George Eliot", year: 1800, coverId: 252882 };

afterEach(() => {
  holder.current = null;
  vi.mocked(searchWorks).mockReset();
});

describe("GET /api/rooms/lookup", () => {
  it("returns the works found", async () => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
    vi.mocked(searchWorks).mockResolvedValue([work]);
    const res = await GET(getRequest(`${URL}?q=${encodeURIComponent(" middlemarch ")}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ works: [work] });
    expect(searchWorks).toHaveBeenCalledWith("middlemarch");
  });

  it.each([["missing", ""], ["one character", "?q=a"], ["over 200 characters", `?q=${"x".repeat(201)}`]])(
    "refuses a query that is %s without asking Open Library",
    async (_label, qs) => {
      holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
      expect((await GET(getRequest(`${URL}${qs}`))).status).toBe(400);
      expect(searchWorks).not.toHaveBeenCalled();
    }
  );

  it("is rate-limited per IP, 30 a minute", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: [{ allowed: false, hits: 31, retry_after: 20 }] } },
    });
    const res = await GET(getRequest(`${URL}?q=middlemarch`, { headers: { "x-forwarded-for": "203.0.113.9" } }));
    expect(res.status).toBe(429);
    expect(holder.current.rpcCalls[0]?.args).toMatchObject({ p_key: "room-lookup:203.0.113.9", p_max: 30, p_window_seconds: 60 });
    expect(searchWorks).not.toHaveBeenCalled();
  });

  it("fails open: Open Library down is a 200 that says unavailable", async () => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
    vi.mocked(searchWorks).mockRejectedValue(new Error("timeout"));
    const res = await GET(getRequest(`${URL}?q=middlemarch`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ works: [], unavailable: true });
  });
});
