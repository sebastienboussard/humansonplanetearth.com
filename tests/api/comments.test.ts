import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { getRequest, jsonRequest, malformedJsonRequest } from "../helpers/request";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

// Anonymous by default; individual tests sign a profile in.
const profileHolder = vi.hoisted(
  () => ({ current: null }) as import("../helpers/auth-mock").ProfileHolder
);
vi.mock("@/lib/profile", async () =>
  (await import("../helpers/auth-mock")).profileModuleMock(profileHolder)
);

vi.mock("@/lib/notifications", () => ({
  notifyPaperComment: vi.fn(),
  notifyCommentReply: vi.fn(),
}));

import { GET, POST } from "@/app/api/comments/route";
import { notifyPaperComment, notifyCommentReply } from "@/lib/notifications";

const URL = "http://localhost:3000/api/comments";

afterEach(() => {
  holder.current = null;
  profileHolder.current = null;
  vi.mocked(notifyPaperComment).mockClear();
  vi.mocked(notifyCommentReply).mockClear();
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

  // A top-level comment on the same paper, returned by the parent lookup that
  // now precedes every reply insert.
  const parent = { id: "c0", word_id: "w1", paper_id: "p1", parent_comment_id: null };

  it("stores a trimmed comment and returns it", async () => {
    holder.current = createMockSupabase({
      tables: { comments: [{ data: parent }, { data: comment }] },
    });

    const res = await POST(
      jsonRequest(URL, { wordId: "w1", paperId: "p1", parentCommentId: "c0", body: "  hello  " })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ comment });
    expect(holder.current.query("comments", 1)!.insert).toHaveBeenCalledWith({
      word_id: "w1",
      paper_id: "p1",
      parent_comment_id: "c0",
      body: "hello",
    });
  });

  it("attaches a reply to a reply to its top-level ancestor", async () => {
    // c1 is itself a reply to c0. Replying to it must land on c0, which is
    // where the reader can actually see it — the UI only renders children of
    // top-level comments.
    const nested = { id: "c1", word_id: "w1", paper_id: "p1", parent_comment_id: "c0" };
    holder.current = createMockSupabase({
      tables: { comments: [{ data: nested }, { data: comment }] },
    });

    const res = await POST(
      jsonRequest(URL, { wordId: "w1", paperId: "p1", parentCommentId: "c1", body: "hello" })
    );

    expect(res.status).toBe(200);
    expect(holder.current.query("comments", 1)!.insert).toHaveBeenCalledWith({
      word_id: "w1",
      paper_id: "p1",
      parent_comment_id: "c0",
      body: "hello",
    });
    // The notification follows the comment, not the request.
    expect(notifyCommentReply).toHaveBeenCalledWith("c0", comment, "w1", "p1", null);
  });

  it("rejects a reply to a comment that no longer exists", async () => {
    holder.current = createMockSupabase({ tables: { comments: { data: null } } });

    const res = await POST(
      jsonRequest(URL, { wordId: "w1", paperId: "p1", parentCommentId: "gone", body: "hello" })
    );

    expect(res.status).toBe(400);
    expect(holder.current.query("comments", 1)).toBeUndefined();
  });

  it("rejects a parent belonging to a different discussion", async () => {
    // Same word, different paper: rendered nowhere if it were allowed through.
    const elsewhere = { id: "c0", word_id: "w1", paper_id: "p2", parent_comment_id: null };
    holder.current = createMockSupabase({ tables: { comments: { data: elsewhere } } });

    const res = await POST(
      jsonRequest(URL, { wordId: "w1", paperId: "p1", parentCommentId: "c0", body: "hello" })
    );

    expect(res.status).toBe(400);
    expect(holder.current.query("comments", 1)).toBeUndefined();
  });

  it("rate-limits comments per IP", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: { allowed: false, retry_after: 900 } } },
    });

    const res = await POST(jsonRequest(URL, { wordId: "w1", body: "hello" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("900");
    expect(holder.current.from).not.toHaveBeenCalled();
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

  it("records no authorship for anonymous comments", async () => {
    holder.current = createMockSupabase({ tables: { comments: { data: comment } } });

    await POST(jsonRequest(URL, { wordId: "w1", body: "hello" }));

    expect(holder.current.query("comment_authors")).toBeUndefined();
  });

  it("records authorship privately from the server session when signed in", async () => {
    profileHolder.current = { id: "prof-1", user_id: "user-1", email: "h@example.com" };
    holder.current = createMockSupabase({
      tables: { comments: { data: comment }, comment_authors: { data: null } },
    });

    const res = await POST(jsonRequest(URL, { wordId: "w1", body: "hello" }));

    expect(holder.current.query("comment_authors")!.insert).toHaveBeenCalledWith({
      comment_id: "c1",
      profile_id: "prof-1",
    });
    // The response never carries author data — comments stay anonymous.
    expect(await res.json()).toEqual({ comment });
  });

  it("still returns the comment when authorship recording fails", async () => {
    profileHolder.current = { id: "prof-1", user_id: "user-1", email: "h@example.com" };
    holder.current = createMockSupabase({
      tables: {
        comments: { data: comment },
        comment_authors: { error: { message: "boom" } },
      },
    });

    const res = await POST(jsonRequest(URL, { wordId: "w1", body: "hello" }));
    expect(res.status).toBe(200);
  });

  it("notifies the paper owner for paper comments", async () => {
    holder.current = createMockSupabase({ tables: { comments: { data: comment } } });

    await POST(jsonRequest(URL, { wordId: "w1", paperId: "p1", body: "hello" }));

    expect(notifyPaperComment).toHaveBeenCalledWith("p1", comment, null);
    expect(notifyCommentReply).not.toHaveBeenCalled();
  });

  it("notifies the parent author for replies, passing the replier's profile", async () => {
    profileHolder.current = { id: "prof-1", user_id: "user-1", email: "h@example.com" };
    holder.current = createMockSupabase({
      tables: {
        comments: [{ data: parent }, { data: comment }],
        comment_authors: { data: null },
      },
    });

    await POST(
      jsonRequest(URL, { wordId: "w1", paperId: "p1", parentCommentId: "c0", body: "hello" })
    );

    expect(notifyCommentReply).toHaveBeenCalledWith("c0", comment, "w1", "p1", "prof-1");
  });
});
