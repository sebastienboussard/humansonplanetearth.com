import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { jsonRequest, malformedJsonRequest } from "../helpers/request";
import { adminCookies } from "../helpers/admin";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import { POST } from "@/app/api/admin/attach/route";

const URL = "http://localhost:3000/api/admin/attach";
const PAPER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const PROFILE = "11111111-2222-3333-4444-555555555555";

afterEach(() => {
  holder.current = null;
});

describe("POST /api/admin/attach", () => {
  it("rejects unauthenticated requests", async () => {
    holder.current = createMockSupabase();
    const res = await POST(jsonRequest(URL, { paperId: PAPER, profileId: PROFILE }));
    expect(res.status).toBe(401);
    expect(holder.current.from).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    holder.current = createMockSupabase();
    const res = await POST(malformedJsonRequest(URL, { cookies: adminCookies() }));
    expect(res.status).toBe(400);
  });

  it("requires both ids to be uuids", async () => {
    holder.current = createMockSupabase();
    const cookies = adminCookies();
    const bad = [
      { paperId: PAPER },
      { profileId: PROFILE },
      { paperId: "not-a-uuid", profileId: PROFILE },
      { paperId: PAPER, profileId: "not-a-uuid" },
    ];
    for (const body of bad) {
      const res = await POST(jsonRequest(URL, body, { cookies }));
      expect(res.status).toBe(400);
    }
  });

  it("upserts the link privately (public_visible stays false)", async () => {
    holder.current = createMockSupabase({ tables: { paper_authors: { data: null } } });

    const res = await POST(
      jsonRequest(URL, { paperId: PAPER, profileId: PROFILE }, { cookies: adminCookies() })
    );

    expect(res.status).toBe(200);
    expect(holder.current.query("paper_authors")!.upsert).toHaveBeenCalledWith(
      { paper_id: PAPER, profile_id: PROFILE, public_visible: false },
      { onConflict: "paper_id" }
    );
  });

  it("returns 500 when the upsert fails", async () => {
    holder.current = createMockSupabase({
      tables: { paper_authors: { error: { message: "boom" } } },
    });
    const res = await POST(
      jsonRequest(URL, { paperId: PAPER, profileId: PROFILE }, { cookies: adminCookies() })
    );
    expect(res.status).toBe(500);
  });
});
