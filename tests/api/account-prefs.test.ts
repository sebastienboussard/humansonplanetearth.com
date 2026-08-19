import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { type UserHolder } from "../helpers/auth-mock";
import { jsonRequest, malformedJsonRequest } from "../helpers/request";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

const userHolder = vi.hoisted(() => ({ current: null }) as UserHolder);
vi.mock("@/lib/supabase-server", async () =>
  (await import("../helpers/auth-mock")).supabaseServerModuleMock(userHolder)
);

import { PATCH } from "@/app/api/account/prefs/route";

const URL = "http://localhost:3000/api/account/prefs";
const user = { id: "user-1", email: "human@example.com" };
const profile = { id: "prof-1", user_id: "user-1", email: "human@example.com" };

function signedInClient() {
  return createMockSupabase({
    tables: {
      profiles: { data: profile },
      notification_prefs: { data: null },
    },
  });
}

afterEach(() => {
  holder.current = null;
  userHolder.current = null;
});

describe("PATCH /api/account/prefs", () => {
  it("returns 401 when not signed in", async () => {
    holder.current = createMockSupabase();
    const res = await PATCH(jsonRequest(URL, { new_word: false }, { method: "PATCH" }));
    expect(res.status).toBe(401);
  });

  it("rejects malformed JSON", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase();
    const res = await PATCH(malformedJsonRequest(URL, { method: "PATCH" }));
    expect(res.status).toBe(400);
  });

  it("rejects unknown preference keys", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase();
    const res = await PATCH(jsonRequest(URL, { spam_me: true }, { method: "PATCH" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/spam_me/);
  });

  it("rejects non-boolean values", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase();
    const res = await PATCH(jsonRequest(URL, { new_word: "yes" }, { method: "PATCH" }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty body", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase();
    const res = await PATCH(jsonRequest(URL, {}, { method: "PATCH" }));
    expect(res.status).toBe(400);
  });

  it("updates only the caller's prefs row", async () => {
    userHolder.current = user;
    holder.current = signedInClient();

    const res = await PATCH(
      jsonRequest(URL, { new_word: false, comment_replies: true }, { method: "PATCH" })
    );

    expect(res.status).toBe(200);
    const q = holder.current.query("notification_prefs")!;
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({ new_word: false, comment_replies: true })
    );
    expect(q.eq).toHaveBeenCalledWith("profile_id", "prof-1");
  });

  it("accepts the three deadline windows", async () => {
    userHolder.current = user;
    holder.current = signedInClient();

    const res = await PATCH(
      jsonRequest(
        URL,
        { deadline_14d: true, deadline_7d: false, deadline_1d: true },
        { method: "PATCH" }
      )
    );

    expect(res.status).toBe(200);
    expect(holder.current.query("notification_prefs")!.update).toHaveBeenCalledWith(
      expect.objectContaining({ deadline_14d: true, deadline_7d: false, deadline_1d: true })
    );
  });

  it("returns 500 when the update fails", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase({
      tables: {
        profiles: { data: profile },
        notification_prefs: { error: { message: "boom" } },
      },
    });
    const res = await PATCH(jsonRequest(URL, { new_word: false }, { method: "PATCH" }));
    expect(res.status).toBe(500);
  });
});
