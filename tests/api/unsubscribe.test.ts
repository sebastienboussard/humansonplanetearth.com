import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { getRequest } from "../helpers/request";
import { unsubscribeUrl } from "@/lib/unsubscribe";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import { GET } from "@/app/api/unsubscribe/route";

const PROFILE = "11111111-2222-3333-4444-555555555555";

afterEach(() => {
  holder.current = null;
});

describe("GET /api/unsubscribe", () => {
  it("rejects missing parameters", async () => {
    holder.current = createMockSupabase();
    const res = await GET(getRequest("http://localhost:3000/api/unsubscribe"));
    expect(res.status).toBe(400);
    expect(holder.current.from).not.toHaveBeenCalled();
  });

  it("rejects a forged signature", async () => {
    holder.current = createMockSupabase();
    const res = await GET(
      getRequest(
        `http://localhost:3000/api/unsubscribe?pid=${PROFILE}&pref=new_word&sig=${"ab".repeat(32)}`
      )
    );
    expect(res.status).toBe(400);
    expect(holder.current.from).not.toHaveBeenCalled();
  });

  it("rejects a valid signature replayed for a different profile", async () => {
    holder.current = createMockSupabase();
    const url = new URL(unsubscribeUrl(PROFILE, "new_word"));
    url.searchParams.set("pid", "99999999-8888-7777-6666-555555555555");
    const res = await GET(getRequest(url.toString()));
    expect(res.status).toBe(400);
  });

  it("rejects a signature replayed for a different pref", async () => {
    holder.current = createMockSupabase();
    const url = new URL(unsubscribeUrl(PROFILE, "new_word"));
    url.searchParams.set("pref", "all");
    const res = await GET(getRequest(url.toString()));
    expect(res.status).toBe(400);
  });

  it("turns off a single pref with a valid link", async () => {
    holder.current = createMockSupabase({ tables: { notification_prefs: { data: null } } });

    const res = await GET(getRequest(unsubscribeUrl(PROFILE, "deadline_reminders")));

    expect(res.status).toBe(200);
    const q = holder.current.query("notification_prefs")!;
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({ deadline_reminders: false })
    );
    expect(q.eq).toHaveBeenCalledWith("profile_id", PROFILE);
  });

  it("pref=all turns off all four categories", async () => {
    holder.current = createMockSupabase({ tables: { notification_prefs: { data: null } } });

    const res = await GET(getRequest(unsubscribeUrl(PROFILE, "all")));

    expect(res.status).toBe(200);
    expect(holder.current.query("notification_prefs")!.update).toHaveBeenCalledWith(
      expect.objectContaining({
        new_word: false,
        deadline_reminders: false,
        paper_comments: false,
        comment_replies: false,
      })
    );
  });

  it("is idempotent — repeating the same link succeeds again", async () => {
    holder.current = createMockSupabase({
      tables: { notification_prefs: [{ data: null }, { data: null }] },
    });
    const url = unsubscribeUrl(PROFILE, "new_word");
    expect((await GET(getRequest(url))).status).toBe(200);
    expect((await GET(getRequest(url))).status).toBe(200);
  });

  it("returns 500 when the update fails", async () => {
    holder.current = createMockSupabase({
      tables: { notification_prefs: { error: { message: "boom" } } },
    });
    const res = await GET(getRequest(unsubscribeUrl(PROFILE, "new_word")));
    expect(res.status).toBe(500);
  });
});
