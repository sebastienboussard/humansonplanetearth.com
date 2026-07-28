import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { getRequest, jsonRequest, malformedJsonRequest } from "../helpers/request";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import { GET, POST } from "@/app/api/comments/route";

const URL = "http://localhost:3000/api/comments";

afterEach(() => {
  holder.current = null;
});

describe("GET /api/comments", () => {
  it("requires a wordId", async () => {
    holder.current = createMockSupabase();
    const res = await GET(getRequest(URL));
    expect(res.status).toBe(400);
  });

  it("returns word-level comments (paper_id is null) when no paperId is given", async () => {
    const rows = [{ id: "c1", body: "hello", created_at: "2026-07-01", parent_comment_id: null }];
    holder.current = createMockSupabase({ tables: { comments: { data: rows } } });

    const res = await GET(getRequest(`${URL}?wordId=w1`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ comments: rows });
    const q = holder.current.query("comments")!;
    expect(q.eq).toHaveBeenCalledWith("word_id", "w1");
    expect(q.is).toHaveBeenCalledWith("paper_id", null);
  });

  it("filters by paperId when given", async () => {
    holder.current = createMockSupabase({ tables: { comments: { data: [] } } });

    await GET(getRequest(`${URL}?wordId=w1&paperId=p1`));

    const q = holder.current.query("comments")!;
    expect(q.eq).toHaveBeenCalledWith("paper_id", "p1");
    expect(q.is).not.toHaveBeenCalled();
  });

  it("returns 500 on a database error", async () => {
    holder.current = createMockSupabase({
      tables: { comments: { error: { message: "boom" } } },
    });
    const res = await GET(getRequest(`${URL}?wordId=w1`));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/comments", () => {
  const comment = { id: "c1", body: "hello", created_at: "2026-07-01", parent_comment_id: null };

  it("silently discards honeypot submissions", async () => {
    holder.current = createMockSupabase();
    const res = await POST(jsonRequest(URL, { wordId: "w1", body: "spam", _trap: "bot" }));

    expect(await res.json()).toEqual({ ok: true });
    expect(holder.current.from).not.toHaveBeenCalled();
  });

  it("requires wordId and a non-empty body", async () => {
    holder.current = createMockSupabase();
    expect((await POST(jsonRequest(URL, { body: "hi" }))).status).toBe(400);
    expect((await POST(jsonRequest(URL, { wordId: "w1" }))).status).toBe(400);
    expect((await POST(jsonRequest(URL, { wordId: "w1", body: "   " }))).status).toBe(400);
  });

  it("rejects comments over 2000 characters", async () => {
    holder.current = createMockSupabase();
    const res = await POST(jsonRequest(URL, { wordId: "w1", body: "x".repeat(2001) }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/2000/);
  });

  it("accepts a comment of exactly 2000 characters", async () => {
    holder.current = createMockSupabase({ tables: { comments: { data: comment } } });
    const res = await POST(jsonRequest(URL, { wordId: "w1", body: "x".repeat(2000) }));
    expect(res.status).toBe(200);
  });

  it("stores a trimmed comment and returns it", async () => {
    holder.current = createMockSupabase({ tables: { comments: { data: comment } } });

    const res = await POST(
      jsonRequest(URL, { wordId: "w1", paperId: "p1", parentCommentId: "c0", body: "  hello  " })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ comment });
    expect(holder.current.query("comments")!.insert).toHaveBeenCalledWith({
      word_id: "w1",
      paper_id: "p1",
      parent_comment_id: "c0",
      body: "hello",
    });
  });

  it("defaults paperId and parentCommentId to null", async () => {
    holder.current = createMockSupabase({ tables: { comments: { data: comment } } });

    await POST(jsonRequest(URL, { wordId: "w1", body: "hello" }));

    expect(holder.current.query("comments")!.insert).toHaveBeenCalledWith({
      word_id: "w1",
      paper_id: null,
      parent_comment_id: null,
      body: "hello",
    });
  });

  it("returns 500 on a database error", async () => {
    holder.current = createMockSupabase({
      tables: { comments: { error: { message: "boom" } } },
    });
    const res = await POST(jsonRequest(URL, { wordId: "w1", body: "hello" }));
    expect(res.status).toBe(500);
  });

  it("returns 500 for a malformed JSON body", async () => {
    holder.current = createMockSupabase();
    const res = await POST(malformedJsonRequest(URL));
    expect(res.status).toBe(500);
  });
});
