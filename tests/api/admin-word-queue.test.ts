import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { getRequest, jsonRequest } from "../helpers/request";
import { adminCookies } from "../helpers/admin";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import { GET, PATCH } from "@/app/api/admin/word-queue/route";

const URL = "http://localhost:3000/api/admin/word-queue";

afterEach(() => {
  holder.current = null;
});

describe("GET /api/admin/word-queue", () => {
  it("rejects a request without an admin session", async () => {
    holder.current = createMockSupabase();
    expect((await GET(getRequest(URL))).status).toBe(401);
    expect(holder.current.query("word_proposals")).toBeUndefined();
  });

  it("returns waiting words in fair order, with rounds, and no proposer identity", async () => {
    holder.current = createMockSupabase({
      tables: {
        word_proposals: {
          data: [
            { id: "p1", profile_id: "ana", word: "tide", created_at: "2026-09-01T00:00:00Z" },
            { id: "p2", profile_id: "ana", word: "salt", created_at: "2026-09-02T00:00:00Z" },
            { id: "p3", profile_id: "ben", word: "ash", created_at: "2026-09-03T00:00:00Z" },
          ],
        },
      },
    });

    const res = await GET(getRequest(URL, { cookies: adminCookies() }));
    const { queue } = await res.json();

    expect(queue.map((q: { word: string; round: number }) => [q.word, q.round])).toEqual([
      ["tide", 1],
      ["ash", 1],
      ["salt", 2],
    ]);
    // The tripwire: nothing that identifies a person leaves this route.
    const body = JSON.stringify(queue);
    expect(body).not.toMatch(/profile_id|email|ana|ben/);
    expect(holder.current.query("word_proposals")!.eq).toHaveBeenCalledWith("status", "waiting");
  });
});

describe("PATCH /api/admin/word-queue", () => {
  it("rejects a request without an admin session", async () => {
    holder.current = createMockSupabase();
    const res = await PATCH(jsonRequest(URL, { id: "p1", status: "declined" }, { method: "PATCH" }));
    expect(res.status).toBe(401);
  });

  it("declines a waiting word and stamps the decision", async () => {
    holder.current = createMockSupabase({ tables: { word_proposals: { data: [{ id: "p1" }] } } });
    const res = await PATCH(
      jsonRequest(URL, { id: "p1", status: "declined" }, { method: "PATCH", cookies: adminCookies() })
    );

    expect(res.status).toBe(200);
    const q = holder.current.query("word_proposals")!;
    expect(q.update).toHaveBeenCalledWith({ status: "declined", decided_at: expect.any(String) });
    expect(q.eq).toHaveBeenCalledWith("status", "waiting");
  });

  it("refuses to set 'used' here, since only word creation does that", async () => {
    holder.current = createMockSupabase();
    const res = await PATCH(
      jsonRequest(URL, { id: "p1", status: "used" }, { method: "PATCH", cookies: adminCookies() })
    );
    expect(res.status).toBe(400);
    expect(holder.current.query("word_proposals")).toBeUndefined();
  });

  it("returns 404 when the word is no longer waiting", async () => {
    holder.current = createMockSupabase({ tables: { word_proposals: { data: [] } } });
    const res = await PATCH(
      jsonRequest(URL, { id: "p1", status: "declined" }, { method: "PATCH", cookies: adminCookies() })
    );
    expect(res.status).toBe(404);
  });
});
