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
