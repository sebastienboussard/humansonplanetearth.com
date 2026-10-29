import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { type UserHolder } from "../helpers/auth-mock";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

const userHolder = vi.hoisted(() => ({ current: null }) as UserHolder);
vi.mock("@/lib/supabase-server", async () =>
  (await import("../helpers/auth-mock")).supabaseServerModuleMock(userHolder)
);

import { GET } from "@/app/api/account/papers/route";

const user = { id: "user-1", email: "human@example.com" };
const profile = { id: "prof-1", user_id: "user-1", email: "human@example.com" };

afterEach(() => {
  holder.current = null;
  userHolder.current = null;
});

describe("GET /api/account/papers", () => {
  it("returns 401 when not signed in", async () => {
    holder.current = createMockSupabase();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns only the caller's papers", async () => {
    userHolder.current = user;
    const rows = [{ paper_id: "p1", papers: { id: "p1" } }];
    holder.current = createMockSupabase({
      tables: {
        profiles: { data: profile },
        paper_authors: { data: rows },
      },
    });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ papers: [{ ...rows[0], change: null }] });
    expect(holder.current.query("paper_authors")!.eq).toHaveBeenCalledWith(
      "profile_id",
      "prof-1"
    );
  });

  it("carries each paper's latest change request (TODO §24)", async () => {
    userHolder.current = user;
    const rows = [
      { paper_id: "p1", papers: { id: "p1" } },
      { paper_id: "p2", papers: { id: "p2" } },
    ];
    holder.current = createMockSupabase({
      tables: {
        profiles: { data: profile },
        paper_authors: { data: rows },
        // Newest first, as the route orders them.
        paper_edit_requests: {
          data: [
            { paper_id: "p1", status: "pending", created_at: "2026-10-28T10:00:00Z", decided_at: null },
            { paper_id: "p1", status: "declined", created_at: "2026-10-01T10:00:00Z", decided_at: "2026-10-02T10:00:00Z" },
          ],
        },
      },
    });

    const res = await GET();
    const body = await res.json();

    expect(body.papers[0].change).toEqual({ status: "pending", at: "2026-10-28T10:00:00Z" });
    expect(body.papers[1].change).toBeNull();
    expect(holder.current.query("paper_edit_requests")!.in).toHaveBeenCalledWith("paper_id", ["p1", "p2"]);
  });

  it("still lists papers when the change lookup fails", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase({
      tables: {
        profiles: { data: profile },
        paper_authors: { data: [{ paper_id: "p1", papers: { id: "p1" } }] },
        paper_edit_requests: { error: { message: "boom" } },
      },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).papers).toHaveLength(1);
  });

  it("returns 500 on a database error", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase({
      tables: {
        profiles: { data: profile },
        paper_authors: { error: { message: "boom" } },
      },
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
