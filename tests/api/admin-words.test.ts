import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { jsonRequest } from "../helpers/request";
import { adminCookies } from "../helpers/admin";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import { POST } from "@/app/api/admin/words/route";

const URL = "http://localhost:3000/api/admin/words";

const validBody = { word: "Hope", month: "8", year: "2026", deadline: "2026-08-31" };

afterEach(() => {
  holder.current = null;
});

describe("POST /api/admin/words", () => {
  it("rejects unauthenticated requests", async () => {
    holder.current = createMockSupabase();
    const res = await POST(jsonRequest(URL, validBody));
    expect(res.status).toBe(401);
  });

  it("requires every field", async () => {
    holder.current = createMockSupabase();
    const cookies = adminCookies();
    for (const missing of ["word", "month", "year", "deadline"] as const) {
      const body = { ...validBody, [missing]: undefined };
      const res = await POST(jsonRequest(URL, body, { cookies }));
      expect(res.status).toBe(400);
    }
  });

  it("rejects out-of-range months and pre-2020 years", async () => {
    holder.current = createMockSupabase();
    const cookies = adminCookies();
    const bad = [
      { ...validBody, month: "0" },
      { ...validBody, month: "13" },
      { ...validBody, year: "2019" },
    ];
    for (const body of bad) {
      const res = await POST(jsonRequest(URL, body, { cookies }));
      expect(res.status).toBe(400);
    }
  });

  it("inserts the word lowercased and trimmed with numeric month/year", async () => {
    holder.current = createMockSupabase({ tables: { words: { data: null } } });

    const res = await POST(
      jsonRequest(URL, { ...validBody, word: "  GRACE  " }, { cookies: adminCookies() })
    );

    expect(res.status).toBe(200);
    expect(holder.current.query("words")!.insert).toHaveBeenCalledWith({
      word: "grace",
      month: 8,
      year: 2026,
      deadline: "2026-08-31",
    });
  });

  it("returns 500 when the insert fails (e.g. duplicate month)", async () => {
    holder.current = createMockSupabase({
      tables: { words: { error: { message: "duplicate key" } } },
    });
    const res = await POST(jsonRequest(URL, validBody, { cookies: adminCookies() }));
    expect(res.status).toBe(500);
  });
});
