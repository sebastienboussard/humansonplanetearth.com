import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { type ProfileHolder } from "../helpers/auth-mock";
import { jsonRequest, malformedJsonRequest } from "../helpers/request";
import { NextRequest } from "next/server";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);
const profileHolder = vi.hoisted(() => ({ current: null }) as ProfileHolder);
vi.mock("@/lib/profile", async () =>
  (await import("../helpers/auth-mock")).profileModuleMock(profileHolder)
);

import { DELETE, GET, POST } from "@/app/api/account/words/route";

const URL = "http://localhost:3000/api/account/words";
const profile = { id: "prof-1", user_id: "user-1", email: "human@example.com" };
const allow = { rate_limit_hit: { data: [{ allowed: true, hits: 1, retry_after: 0 }] } };

function del(id?: string) {
  return new NextRequest(id ? `${URL}?id=${id}` : URL, { method: "DELETE" });
}
function pgError(message: string, code: string) {
  return { message, code } as { message: string };
}

afterEach(() => {
  holder.current = null;
  profileHolder.current = null;
});

describe("GET /api/account/words", () => {
  it("returns 401 when not signed in", async () => {
    holder.current = createMockSupabase();
    expect((await GET()).status).toBe(401);
  });

  it("lists only the session's own words, newest first", async () => {
    profileHolder.current = profile;
    const words = [{ id: "p1", word: "tide", status: "waiting", created_at: "2026-10-01" }];
    holder.current = createMockSupabase({ tables: { word_proposals: { data: words } } });

    const res = await GET();
    expect(await res.json()).toEqual({ words, maxWaiting: 3 });
    const q = holder.current.query("word_proposals")!;
    expect(q.eq).toHaveBeenCalledWith("profile_id", "prof-1");
    // Status only: the proposer never sees a round or a position.
    expect(q.select).toHaveBeenCalledWith("id, word, status, created_at");
  });
});

describe("POST /api/account/words", () => {
  it("is rate-limited per IP before anything else", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: [{ allowed: false, hits: 11, retry_after: 900 }] } },
    });
    const res = await POST(jsonRequest(URL, { word: "tide" }, { headers: { "x-forwarded-for": "203.0.113.2" } }));
    expect(res.status).toBe(429);
    expect(holder.current.rpcCalls[0]?.args).toMatchObject({ p_key: "word-proposal:203.0.113.2" });
  });

  it("returns 401 when not signed in", async () => {
    holder.current = createMockSupabase({ rpcs: allow });
    expect((await POST(jsonRequest(URL, { word: "tide" }))).status).toBe(401);
  });

  it("refuses an invalid word before touching the database", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({ rpcs: allow });
    for (const word of ["a", "two words", "t1de", "__long-form__", 42]) {
      expect((await POST(jsonRequest(URL, { word }))).status).toBe(400);
    }
    expect(holder.current.query("word_proposals")).toBeUndefined();
  });

  it("refuses a body that is not JSON", async () => {
    holder.current = createMockSupabase({ rpcs: allow });
    expect((await POST(malformedJsonRequest(URL))).status).toBe(400);
  });

  it("stores the word normalized, against the session's profile", async () => {
    profileHolder.current = profile;
    const created = { id: "p9", word: "tide", status: "waiting", created_at: "2026-10-26" };
    holder.current = createMockSupabase({
      rpcs: allow,
      tables: { word_proposals: [{ data: [] }, { data: created }], words: { data: null } },
    });

    const res = await POST(jsonRequest(URL, { word: "  Tide " }));
    expect(res.status).toBe(201);
    expect(holder.current.query("word_proposals", 1)!.insert).toHaveBeenCalledWith({
      profile_id: "prof-1",
      word: "tide",
    });
  });

  it("refuses a fourth waiting word with a 409 that explains why", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({
      rpcs: allow,
      tables: { word_proposals: { data: [{ id: "a" }, { id: "b" }, { id: "c" }] } },
    });
    const res = await POST(jsonRequest(URL, { word: "tide" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/3 words waiting/);
  });

  it("maps the trigger's cap to a 409 when a race beats the read-then-write check", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({
      rpcs: allow,
      tables: {
        word_proposals: [{ data: [] }, { error: pgError("word_proposal_cap", "23514") }],
        words: { data: null },
      },
    });
    const res = await POST(jsonRequest(URL, { word: "tide" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/3 words waiting/);
  });

  it("maps the waiting-word unique index to a 409", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({
      rpcs: allow,
      tables: {
        word_proposals: [{ data: [] }, { error: pgError("duplicate key", "23505") }],
        words: { data: null },
      },
    });
    const res = await POST(jsonRequest(URL, { word: "tide" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already waiting/);
  });

  it("refuses a word that has already been a word of the month", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({
      rpcs: allow,
      tables: { word_proposals: { data: [] }, words: { data: { id: "w1" } } },
    });
    const res = await POST(jsonRequest(URL, { word: "hope" }));
    expect(res.status).toBe(409);
    expect(holder.current.query("word_proposals", 1)).toBeUndefined();
  });
});

describe("DELETE /api/account/words", () => {
  it("returns 401 when not signed in", async () => {
    holder.current = createMockSupabase();
    expect((await DELETE(del("p1"))).status).toBe(401);
  });

  it("needs an id", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase();
    expect((await DELETE(del())).status).toBe(400);
  });

  it("withdraws only the session's own waiting word", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({ tables: { word_proposals: { data: [{ id: "p1" }] } } });

    expect((await DELETE(del("p1"))).status).toBe(200);
    const q = holder.current.query("word_proposals")!;
    expect(q.delete).toHaveBeenCalled();
    expect(q.eq).toHaveBeenCalledWith("id", "p1");
    expect(q.eq).toHaveBeenCalledWith("profile_id", "prof-1");
    expect(q.eq).toHaveBeenCalledWith("status", "waiting");
  });

  it("returns 404 for someone else's, a used, or a declined word", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({ tables: { word_proposals: { data: [] } } });
    expect((await DELETE(del("p1"))).status).toBe(404);
  });
});
