import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { jsonRequest, malformedJsonRequest } from "../helpers/request";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

vi.mock("@/lib/admin-alerts", () => ({
  notifyAdminNewPaper: vi.fn(async () => undefined),
  notifyAdminNewMessage: vi.fn(async () => false),
}));

import { POST } from "@/app/api/contact/route";
import { notifyAdminNewMessage } from "@/lib/admin-alerts";

const URL = "http://localhost:3000/api/contact";

afterEach(() => {
  holder.current = null;
  vi.mocked(notifyAdminNewMessage).mockClear();
  vi.mocked(notifyAdminNewMessage).mockResolvedValue(false);
});

describe("POST /api/contact", () => {
  it("silently discards honeypot submissions without inserting or emailing", async () => {
    holder.current = createMockSupabase();
    const res = await POST(jsonRequest(URL, { body: "spam", _trap: "bot" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(holder.current.from).not.toHaveBeenCalled();
    expect(notifyAdminNewMessage).not.toHaveBeenCalled();
  });

  it("rejects an empty or whitespace-only message", async () => {
    holder.current = createMockSupabase();
    expect((await POST(jsonRequest(URL, { body: "" }))).status).toBe(400);
    expect((await POST(jsonRequest(URL, { body: "   " }))).status).toBe(400);
    expect((await POST(jsonRequest(URL, {}))).status).toBe(400);
  });

  it("rejects messages over 5000 characters", async () => {
    holder.current = createMockSupabase();
    const res = await POST(jsonRequest(URL, { body: "x".repeat(5001) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/5000/);
  });

  it("rejects an invalid reply email", async () => {
    holder.current = createMockSupabase();
    const res = await POST(jsonRequest(URL, { body: "hello", reply_email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 for a malformed JSON body", async () => {
    holder.current = createMockSupabase();
    const res = await POST(malformedJsonRequest(URL));
    expect(res.status).toBe(500);
  });

  it("stores a trimmed message and alerts the admin inbox", async () => {
    holder.current = createMockSupabase({ tables: { messages: { data: null } } });

    const res = await POST(
      jsonRequest(URL, { body: "  I have thoughts  ", reply_email: " reader@example.com " })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(holder.current.query("messages")!.insert).toHaveBeenCalledWith({
      body: "I have thoughts",
      reply_email: "reader@example.com",
    });
    expect(notifyAdminNewMessage).toHaveBeenCalledWith({
      body: "I have thoughts",
      replyEmail: "reader@example.com",
    });
  });

  it("treats a blank reply email as none", async () => {
    holder.current = createMockSupabase({ tables: { messages: { data: null } } });
    const res = await POST(jsonRequest(URL, { body: "hello", reply_email: "  " }));

    expect(res.status).toBe(200);
    expect(holder.current.query("messages")!.insert).toHaveBeenCalledWith({
      body: "hello",
      reply_email: null,
    });
  });

  it("returns 500 when the insert fails and no alert email went out", async () => {
    holder.current = createMockSupabase({
      tables: { messages: { error: { message: "PGRST205: table missing" } } },
    });
    const res = await POST(jsonRequest(URL, { body: "hello" }));
    expect(res.status).toBe(500);
  });

  // The production `messages` table has been missing before (TODO §1a) and
  // every message sent was lost. The email is sent before the insert so the
  // message still reaches a human — and the visitor isn't told it failed.
  it("returns 200 when the insert fails but the alert email was delivered", async () => {
    vi.mocked(notifyAdminNewMessage).mockResolvedValueOnce(true);
    holder.current = createMockSupabase({
      tables: { messages: { error: { message: "PGRST205: table missing" } } },
    });

    const res = await POST(jsonRequest(URL, { body: "hello" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("still succeeds when the alert itself rejects", async () => {
    vi.mocked(notifyAdminNewMessage).mockRejectedValueOnce(new Error("resend down"));
    holder.current = createMockSupabase({ tables: { messages: { data: null } } });

    const res = await POST(jsonRequest(URL, { body: "hello" }));
    expect(res.status).toBe(200);
  });
});
