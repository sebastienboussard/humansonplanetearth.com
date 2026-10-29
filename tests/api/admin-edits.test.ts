import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { getRequest, jsonRequest } from "../helpers/request";
import { adminCookies } from "../helpers/admin";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import { GET, PATCH } from "@/app/api/admin/edits/route";

// Change requests on papers (TODO §24).

const URL = "http://localhost:3000/api/admin/edits";

afterEach(() => {
  holder.current = null;
});

function patch(body: unknown, cookies: Record<string, string> = adminCookies()) {
  return PATCH(jsonRequest(URL, body, { method: "PATCH", cookies }));
}

describe("GET /api/admin/edits", () => {
  it("rejects requests with no session cookie", async () => {
    holder.current = createMockSupabase();
    const res = await GET(getRequest(URL));
    expect(res.status).toBe(401);
  });

  it("lists pending requests with both PDFs and no author", async () => {
    holder.current = createMockSupabase({
      tables: {
        paper_edit_requests: {
          data: [
            {
              id: "e1",
              note: "Fixed a typo",
              pdf_path: "w1/new.pdf",
              created_at: "2026-10-28T10:00:00Z",
              papers: {
                id: "p1",
                type: "word",
                title: null,
                status: "approved",
                pdf_url: "w1/old.pdf",
                words: { word: "threshold", month: 10, year: 2026 },
              },
            },
          ],
        },
      },
    });

    const res = await GET(getRequest(URL, { cookies: adminCookies() }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(holder.current.query("paper_edit_requests")!.eq).toHaveBeenCalledWith("status", "pending");
    expect(body.edits).toEqual([
      {
        id: "e1",
        note: "Fixed a typo",
        created_at: "2026-10-28T10:00:00Z",
        paper: {
          id: "p1",
          type: "word",
          title: null,
          status: "approved",
          words: { word: "threshold", month: 10, year: 2026 },
        },
        current_url: "https://storage.test/papers/w1/old.pdf",
        replacement_url: "https://storage.test/papers/w1/new.pdf",
      },
    ]);
  });
});

describe("PATCH /api/admin/edits", () => {
  it("rejects requests with no session cookie", async () => {
    holder.current = createMockSupabase();
    const res = await patch({ id: "e1", decision: "apply" }, {});
    expect(res.status).toBe(401);
  });

  it("rejects an unknown decision", async () => {
    holder.current = createMockSupabase();
    const res = await patch({ id: "e1", decision: "approve" });
    expect(res.status).toBe(400);
  });

  it("applies through the RPC, then removes the old file", async () => {
    holder.current = createMockSupabase({
      rpcs: { apply_paper_edit: { data: "w1/old.pdf" } },
    });

    const res = await patch({ id: "e1", decision: "apply" });

    expect(res.status).toBe(200);
    expect(holder.current.rpcCalls).toEqual([{ fn: "apply_paper_edit", args: { p_request: "e1" } }]);
    expect(holder.current.bucket("papers")!.remove).toHaveBeenCalledWith(["w1/old.pdf"]);
  });

  it("removes nothing when the RPC refuses the apply", async () => {
    holder.current = createMockSupabase({
      rpcs: { apply_paper_edit: { error: { message: "change request is not pending" } } },
    });

    const res = await patch({ id: "e1", decision: "apply" });

    expect(res.status).toBe(409);
    expect(holder.current.bucket("papers")).toBeUndefined();
  });

  it("declines: marks the request and removes the replacement", async () => {
    holder.current = createMockSupabase({
      tables: {
        paper_edit_requests: [
          { data: { id: "e1", pdf_path: "w1/new.pdf", status: "pending" } },
          { data: [{ id: "e1" }] },
        ],
      },
    });

    const res = await patch({ id: "e1", decision: "decline" });

    expect(res.status).toBe(200);
    const update = holder.current.query("paper_edit_requests", 1)!;
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ status: "declined" }));
    expect(update.eq).toHaveBeenCalledWith("status", "pending");
    expect(holder.current.bucket("papers")!.remove).toHaveBeenCalledWith(["w1/new.pdf"]);
  });

  it("returns 404 when declining an unknown request", async () => {
    holder.current = createMockSupabase({ tables: { paper_edit_requests: { data: null } } });
    const res = await patch({ id: "nope", decision: "decline" });
    expect(res.status).toBe(404);
  });

  it("will not decline a request that was already decided", async () => {
    holder.current = createMockSupabase({
      tables: { paper_edit_requests: { data: { id: "e1", pdf_path: "w1/new.pdf", status: "applied" } } },
    });

    const res = await patch({ id: "e1", decision: "decline" });

    expect(res.status).toBe(409);
    // The file is the paper's own by now — it must survive.
    expect(holder.current.bucket("papers")).toBeUndefined();
  });

  it("keeps the file when an apply wins the race to a decline", async () => {
    holder.current = createMockSupabase({
      tables: {
        paper_edit_requests: [
          { data: { id: "e1", pdf_path: "w1/new.pdf", status: "pending" } },
          { data: [] },
        ],
      },
    });

    const res = await patch({ id: "e1", decision: "decline" });

    expect(res.status).toBe(409);
    expect(holder.current.bucket("papers")).toBeUndefined();
  });
});
