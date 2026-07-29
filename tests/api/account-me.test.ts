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

import { GET } from "@/app/api/account/me/route";

const user = { id: "user-1", email: "human@example.com" };
const profile = { id: "prof-1", user_id: "user-1", email: "human@example.com" };
const prefs = {
  new_word: true,
  deadline_reminders: false,
  paper_comments: true,
  comment_replies: true,
};

afterEach(() => {
  holder.current = null;
  userHolder.current = null;
});

describe("GET /api/account/me", () => {
  it("returns 401 when not signed in", async () => {
    holder.current = createMockSupabase();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("lazily creates the profile and default prefs on first sign-in", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase({
      tables: {
        // First from("profiles"): lookup misses; second: insert returns the row.
        profiles: [{ data: null }, { data: profile }],
        // First from("notification_prefs"): defaults insert; second: prefs fetch.
        notification_prefs: [{ data: null }, { data: prefs }],
      },
    });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(holder.current.query("profiles", 1)!.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      email: "human@example.com",
    });
    expect(holder.current.query("notification_prefs", 0)!.insert).toHaveBeenCalledWith({
      profile_id: "prof-1",
      new_word: true,
      deadline_reminders: true,
      paper_comments: true,
      comment_replies: true,
    });
  });

  it("returns the profile id and prefs without ever exposing user_id", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase({
      tables: {
        profiles: { data: profile },
        notification_prefs: { data: prefs },
      },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      profile: { id: "prof-1", email: "human@example.com" },
      prefs,
    });
    expect(JSON.stringify(body)).not.toContain("user-1");
  });

  it("returns 500 when profile creation fails", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase({
      tables: {
        profiles: [{ data: null }, { error: { message: "boom" } }],
      },
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
