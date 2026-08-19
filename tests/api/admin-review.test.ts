import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { getRequest, jsonRequest } from "../helpers/request";
import { adminCookies } from "../helpers/admin";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import { GET, PATCH, DELETE } from "@/app/api/admin/review/route";

const URL = "http://localhost:3000/api/admin/review";

afterEach(() => {
  holder.current = null;
});

describe("GET /api/admin/review", () => {
  it("rejects requests with no session cookie", async () => {
    holder.current = createMockSupabase();
    const res = await GET(getRequest(URL));
    expect(res.status).toBe(401);
  });

  it("rejects requests with a forged session cookie", async () => {
    holder.current = createMockSupabase();
    const res = await GET(getRequest(URL, { cookies: { admin_session: "forged-token" } }));
    expect(res.status).toBe(401);
  });

  it("rejects unknown status filters", async () => {
    holder.current = createMockSupabase();
    const res = await GET(getRequest(`${URL}?status=rejected`, { cookies: adminCookies() }));
    expect(res.status).toBe(400);
  });

  it("lists pending papers by default, enriched with a public URL", async () => {
    const paper = {
      id: "p1",
      word_id: "w1",
      type: "word",
      title: null,
      pdf_url: "w1/123.pdf",
      submitted_at: "2026-07-01",
      words: { word: "hope", month: 7, year: 2026 },
    };
    holder.current = createMockSupabase({ tables: { papers: { data: [paper] } } });

    const res = await GET(getRequest(URL, { cookies: adminCookies() }));

    expect(res.status).toBe(200);
    const { papers } = await res.json();
    expect(papers).toHaveLength(1);
    expect(papers[0].signed_url).toBe("https://storage.test/papers/w1/123.pdf");
    expect(holder.current.query("papers")!.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("lists approved papers when requested", async () => {
    holder.current = createMockSupabase({ tables: { papers: { data: [] } } });

    const res = await GET(getRequest(`${URL}?status=approved`, { cookies: adminCookies() }));

    expect(res.status).toBe(200);
    expect(holder.current.query("papers")!.eq).toHaveBeenCalledWith("status", "approved");
  });

  it("returns 500 on a database error", async () => {
    holder.current = createMockSupabase({ tables: { papers: { error: { message: "boom" } } } });
    const res = await GET(getRequest(URL, { cookies: adminCookies() }));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admin/review", () => {
  it("rejects unauthenticated requests", async () => {
    holder.current = createMockSupabase();
    const res = await PATCH(jsonRequest(URL, { id: "p1", status: "approved" }, { method: "PATCH" }));
    expect(res.status).toBe(401);
  });

  it("rejects a missing id or an invalid status", async () => {
    holder.current = createMockSupabase();
    const cookies = adminCookies();
    const bad = [
      { status: "approved" },
      { id: "p1", status: "pending" },
      { id: "p1", status: "published" },
    ];
    for (const body of bad) {
      const res = await PATCH(jsonRequest(URL, body, { method: "PATCH", cookies }));
      expect(res.status).toBe(400);
    }
  });

  it("approves a paper", async () => {
    holder.current = createMockSupabase({ tables: { papers: { data: null } } });

    const res = await PATCH(
      jsonRequest(URL, { id: "p1", status: "approved" }, { method: "PATCH", cookies: adminCookies() })
    );

    expect(res.status).toBe(200);
    const q = holder.current.query("papers")!;
    expect(q.update).toHaveBeenCalledWith({ status: "approved" });
    expect(q.eq).toHaveBeenCalledWith("id", "p1");
  });

  it("rejects a paper and deletes its PDF from storage", async () => {
    // Rejecting used to leave the file in the bucket, still downloadable by
    // anyone who knew the path. The lookup runs first, then the update.
    holder.current = createMockSupabase({
      tables: { papers: [{ data: { pdf_url: "word-1/abc.pdf" } }, { data: null }] },
    });

    const res = await PATCH(
      jsonRequest(URL, { id: "p1", status: "rejected" }, { method: "PATCH", cookies: adminCookies() })
    );

    expect(res.status).toBe(200);
    expect(holder.current.query("papers", 1)!.update).toHaveBeenCalledWith({ status: "rejected" });
    expect(holder.current.bucket("papers")!.remove).toHaveBeenCalledWith(["word-1/abc.pdf"]);
  });

  it("still rejects when the paper has no stored file", async () => {
    holder.current = createMockSupabase({
      tables: { papers: [{ data: null }, { data: null }] },
    });

    const res = await PATCH(
      jsonRequest(URL, { id: "p1", status: "rejected" }, { method: "PATCH", cookies: adminCookies() })
    );

    expect(res.status).toBe(200);
    expect(holder.current.bucket("papers")).toBeUndefined();
  });

  it("does not touch storage when approving", async () => {
    holder.current = createMockSupabase({ tables: { papers: { data: null } } });

    await PATCH(
      jsonRequest(URL, { id: "p1", status: "approved" }, { method: "PATCH", cookies: adminCookies() })
    );

    expect(holder.current.bucket("papers")).toBeUndefined();
  });

  it("reports success even if the storage removal fails", async () => {
    // The database is the record of what is published; a stuck bucket must not
    // leave the admin unable to reject.
    holder.current = createMockSupabase({
      tables: { papers: [{ data: { pdf_url: "word-1/abc.pdf" } }, { data: null }] },
      storage: { removeError: { message: "bucket unavailable" } },
    });

    const res = await PATCH(
      jsonRequest(URL, { id: "p1", status: "rejected" }, { method: "PATCH", cookies: adminCookies() })
    );

    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/admin/review", () => {
  it("rejects unauthenticated requests", async () => {
    holder.current = createMockSupabase();
    const res = await DELETE(jsonRequest(URL, { id: "p1" }, { method: "DELETE" }));
    expect(res.status).toBe(401);
  });

  it("rejects a missing id", async () => {
    holder.current = createMockSupabase();
    const res = await DELETE(jsonRequest(URL, {}, { method: "DELETE", cookies: adminCookies() }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown paper", async () => {
    holder.current = createMockSupabase({ tables: { papers: { data: null } } });
    const res = await DELETE(
      jsonRequest(URL, { id: "missing" }, { method: "DELETE", cookies: adminCookies() })
    );
    expect(res.status).toBe(404);
  });

  it("removes the stored PDF and the database row", async () => {
    holder.current = createMockSupabase({
      tables: {
        papers: [{ data: { id: "p1", pdf_url: "w1/123.pdf" } }, { data: null }],
      },
    });

    const res = await DELETE(
      jsonRequest(URL, { id: "p1" }, { method: "DELETE", cookies: adminCookies() })
    );

    expect(res.status).toBe(200);
    expect(holder.current.bucket("papers")!.remove).toHaveBeenCalledWith(["w1/123.pdf"]);
    const deleteQuery = holder.current.query("papers", 1)!;
    expect(deleteQuery.delete).toHaveBeenCalled();
    expect(deleteQuery.eq).toHaveBeenCalledWith("id", "p1");
  });
});
