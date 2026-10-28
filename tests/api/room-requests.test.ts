import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { jsonRequest, malformedJsonRequest } from "../helpers/request";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);
vi.mock("@/lib/admin-alerts", () => ({ notifyAdminRoomRequest: vi.fn(async () => {}) }));

import { POST } from "@/app/api/rooms/requests/route";
import { notifyAdminRoomRequest } from "@/lib/admin-alerts";

const URL = "http://localhost:3000/api/rooms/requests";
const allow = { data: [{ allowed: true, hits: 1, retry_after: 0 }] };
const pgError = (message: string, code: string) => ({ message, code }) as { message: string };
const room = { title: "Middlemarch", medium: "book", sections: ["Book One"] };

afterEach(() => {
  holder.current = null;
  vi.mocked(notifyAdminRoomRequest).mockClear();
});

describe("POST /api/rooms/requests", () => {
  it("is rate-limited per IP before anything else", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: [{ allowed: false, hits: 4, retry_after: 600 }] } },
    });
    const res = await POST(jsonRequest(URL, room, { headers: { "x-forwarded-for": "203.0.113.4" } }));
    expect(res.status).toBe(429);
    expect(holder.current.rpcCalls[0]?.args).toMatchObject({ p_key: "room-request:203.0.113.4" });
  });

  it("needs no account, and files the room as a request with no author", async () => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow, request_room: { data: "room-1" } } });
    const res = await POST(jsonRequest(URL, { ...room, reply_email: " reader@example.com " }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ ok: true, status: "requested" });
    expect(JSON.stringify(body)).not.toMatch(/reader@|slug/);

    const call = holder.current.rpcCalls.find((c) => c.fn === "request_room")!;
    expect(call.args).toMatchObject({
      p_slug: "middlemarch",
      p_title: "Middlemarch",
      p_medium: "book",
      p_reply_email: "reader@example.com",
      p_sections: [
        { label: "Book One", kind: "part" },
        { label: "The whole work", kind: "whole" },
      ],
    });
    expect(call.args).not.toHaveProperty("p_profile_id");
    expect(call.args).toMatchObject({ p_links: [] });
    expect(holder.current.rpcCalls.map((c) => c.fn)).not.toContain("create_room");
    expect(notifyAdminRoomRequest).toHaveBeenCalledWith({ title: "Middlemarch" });
  });

  it("sends a null email when none is given", async () => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow, request_room: { data: "room-1" } } });
    await POST(jsonRequest(URL, { ...room, reply_email: "  " }));
    expect(holder.current.rpcCalls.find((c) => c.fn === "request_room")!.args).toMatchObject({ p_reply_email: null });
  });

  it("silently discards honeypot submissions", async () => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
    const res = await POST(jsonRequest(URL, { ...room, _trap: "bot" }));
    expect(await res.json()).toEqual({ ok: true });
    expect(holder.current.rpcCalls.map((c) => c.fn)).not.toContain("request_room");
    expect(notifyAdminRoomRequest).not.toHaveBeenCalled();
  });

  it.each([
    ["no title", { ...room, title: " " }],
    ["an unknown medium", { ...room, medium: "podcast" }],
    ["a malformed email", { ...room, reply_email: "not-an-email" }],
    ["a javascript: link", { ...room, links: ["javascript:alert(1)"] }],
  ])("refuses %s before calling the database", async (_label, body) => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
    expect((await POST(jsonRequest(URL, body))).status).toBe(400);
    expect(holder.current.rpcCalls.map((c) => c.fn)).not.toContain("request_room");
  });

  it("refuses a body that is not JSON", async () => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
    expect((await POST(malformedJsonRequest(URL))).status).toBe(400);
  });

  it("retries once with a suffix when the slug is taken", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow, request_room: { error: pgError('duplicate key "rooms_slug_key"', "23505") } },
    });
    const res = await POST(jsonRequest(URL, room));
    const slugs = holder.current.rpcCalls
      .filter((c) => c.fn === "request_room")
      .map((c) => (c.args as { p_slug: string }).p_slug);
    expect(slugs).toHaveLength(2);
    expect(slugs[1]).toMatch(/^middlemarch-[a-z2-9]{4}$/);
    expect(res.status).toBe(500);
    expect(notifyAdminRoomRequest).not.toHaveBeenCalled();
  });

  it("maps a full queue to a 409", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow, request_room: { error: pgError("room_request_cap", "23514") } },
    });
    const res = await POST(jsonRequest(URL, room));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/a lot of room requests/);
  });
});
