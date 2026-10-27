import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { jsonRequest } from "../helpers/request";
import { adminCookies } from "../helpers/admin";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

vi.mock("@/lib/notifications", () => ({
  notifyNewWord: vi.fn(),
}));

import { GET, POST } from "@/app/api/admin/words/route";
import { notifyNewWord } from "@/lib/notifications";
import { getRequest } from "../helpers/request";

const URL = "http://localhost:3000/api/admin/words";

const validBody = { word: "Hope", month: "8", year: "2026", deadline: "2026-08-31" };

afterEach(() => {
  holder.current = null;
  vi.mocked(notifyNewWord).mockClear();
});

describe("GET /api/admin/words", () => {
  it("rejects unauthenticated requests", async () => {
    holder.current = createMockSupabase();
    const res = await GET(getRequest(URL));
    expect(res.status).toBe(401);
  });

  it("lists words, excluding the long-form sentinel", async () => {
    const rows = [
      { id: "w2", word: "regret", month: 7, year: 2026, deadline: "2026-07-31" },
      { id: "w1", word: "stardust", month: 4, year: 2026, deadline: "2026-04-30" },
    ];
    holder.current = createMockSupabase({ tables: { words: { data: rows } } });

    const res = await GET(getRequest(URL, { cookies: adminCookies() }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ words: rows });
    const q = holder.current.query("words")!;
    expect(q.neq).toHaveBeenCalledWith("word", "__long-form__");
    expect(q.order).toHaveBeenCalledWith("year", { ascending: false });
    expect(q.order).toHaveBeenCalledWith("month", { ascending: false });
  });

  it("returns 500 when the select fails", async () => {
    holder.current = createMockSupabase({
      tables: { words: { error: { message: "boom" } } },
    });
    const res = await GET(getRequest(URL, { cookies: adminCookies() }));
    expect(res.status).toBe(500);
  });
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

  it("returns 500 when the insert fails for a reason other than a duplicate", async () => {
    holder.current = createMockSupabase({
      tables: { words: { error: { message: "connection reset" } } },
    });
    const res = await POST(jsonRequest(URL, validBody, { cookies: adminCookies() }));
    expect(res.status).toBe(500);
    expect(notifyNewWord).not.toHaveBeenCalled();
  });

  it("returns 409, not 500, when the word already exists", async () => {
    // A queued word can be added by hand in the meantime (TODO §20).
    holder.current = createMockSupabase({
      tables: { words: { error: { message: "duplicate key", code: "23505" } as { message: string } } },
    });
    const res = await POST(jsonRequest(URL, validBody, { cookies: adminCookies() }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already a word/);
    expect(notifyNewWord).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    holder.current = createMockSupabase();
    const req = new (await import("next/server")).NextRequest(URL, {
      method: "POST",
      headers: { cookie: `admin_session=${adminCookies().admin_session}` },
      body: "{not json",
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("marks the proposal it came from as used, linked to the new word", async () => {
    const created = { id: "w9", word: "tide", deadline: "2026-11-30" };
    holder.current = createMockSupabase({ tables: { words: { data: created }, word_proposals: { data: null } } });

    const res = await POST(
      jsonRequest(URL, { ...validBody, word: "tide", proposalId: "prop-1" }, { cookies: adminCookies() })
    );

    expect(res.status).toBe(200);
    const mark = holder.current.query("word_proposals")!;
    expect(mark.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "used", used_word_id: "w9", decided_at: expect.any(String) })
    );
    expect(mark.eq).toHaveBeenCalledWith("id", "prop-1");
    expect(mark.eq).toHaveBeenCalledWith("status", "waiting");
  });

  it("still creates the word if marking the proposal fails", async () => {
    const created = { id: "w9", word: "tide", deadline: "2026-11-30" };
    holder.current = createMockSupabase({
      tables: { words: { data: created }, word_proposals: { error: { message: "boom" } } },
    });
    const res = await POST(
      jsonRequest(URL, { ...validBody, word: "tide", proposalId: "prop-1" }, { cookies: adminCookies() })
    );
    expect(res.status).toBe(200);
    expect(notifyNewWord).toHaveBeenCalledWith(created);
  });

  it("touches no proposal when the word was added by hand", async () => {
    holder.current = createMockSupabase({ tables: { words: { data: { id: "w1", word: "hope", deadline: "x" } } } });
    await POST(jsonRequest(URL, validBody, { cookies: adminCookies() }));
    expect(holder.current.query("word_proposals")).toBeUndefined();
  });

  it("notifies subscribers after a successful insert", async () => {
    const created = { id: "w1", word: "grace", deadline: "2026-08-31" };
    holder.current = createMockSupabase({ tables: { words: { data: created } } });

    const res = await POST(jsonRequest(URL, validBody, { cookies: adminCookies() }));

    expect(res.status).toBe(200);
    expect(notifyNewWord).toHaveBeenCalledWith(created);
  });

  it("still succeeds when notification fan-out throws", async () => {
    vi.mocked(notifyNewWord).mockRejectedValueOnce(new Error("smtp down"));
    holder.current = createMockSupabase({
      tables: { words: { data: { id: "w1", word: "grace", deadline: "2026-08-31" } } },
    });

    const res = await POST(jsonRequest(URL, validBody, { cookies: adminCookies() }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
