import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { type UserHolder } from "../helpers/auth-mock";
import { jsonRequest } from "../helpers/request";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

const userHolder = vi.hoisted(() => ({ current: null }) as UserHolder);
vi.mock("@/lib/supabase-server", async () =>
  (await import("../helpers/auth-mock")).supabaseServerModuleMock(userHolder)
);

import { GET, PATCH } from "@/app/api/account/papers/route";

const URL = "http://localhost:3000/api/account/papers";
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
    const rows = [{ paper_id: "p1", public_visible: false, papers: { id: "p1" } }];
    holder.current = createMockSupabase({
      tables: {
        profiles: { data: profile },
        paper_authors: { data: rows },
      },
    });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ papers: rows });
    expect(holder.current.query("paper_authors")!.eq).toHaveBeenCalledWith(
      "profile_id",
      "prof-1"
    );
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

describe("PATCH /api/account/papers", () => {
  it("returns 401 when not signed in", async () => {
    holder.current = createMockSupabase();
    const res = await PATCH(
      jsonRequest(URL, { paperId: "p1", publicVisible: true }, { method: "PATCH" })
    );
    expect(res.status).toBe(401);
  });

  it("requires paperId (string) and publicVisible (boolean)", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase();
    const bad = [
      { paperId: "p1" },
      { publicVisible: true },
      { paperId: "p1", publicVisible: "yes" },
      { paperId: 42, publicVisible: true },
    ];
    for (const body of bad) {
      const res = await PATCH(jsonRequest(URL, body, { method: "PATCH" }));
      expect(res.status).toBe(400);
    }
  });

  it("updates visibility filtered by BOTH paper and owning profile", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase({
      tables: {
        profiles: { data: profile },
        paper_authors: { data: null },
      },
    });

    const res = await PATCH(
      jsonRequest(URL, { paperId: "p1", publicVisible: true }, { method: "PATCH" })
    );

    expect(res.status).toBe(200);
    const q = holder.current.query("paper_authors")!;
    expect(q.update).toHaveBeenCalledWith({ public_visible: true });
    // Ownership guard — without the profile filter anyone could toggle any paper.
    expect(q.eq).toHaveBeenCalledWith("paper_id", "p1");
    expect(q.eq).toHaveBeenCalledWith("profile_id", "prof-1");
  });

  it("returns 500 when the update fails", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase({
      tables: {
        profiles: { data: profile },
        paper_authors: { error: { message: "boom" } },
      },
    });
    const res = await PATCH(
      jsonRequest(URL, { paperId: "p1", publicVisible: false }, { method: "PATCH" })
    );
    expect(res.status).toBe(500);
  });
});
