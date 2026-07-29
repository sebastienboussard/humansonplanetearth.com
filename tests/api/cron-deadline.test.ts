import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { getRequest } from "../helpers/request";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

vi.mock("@/lib/notifications", () => ({
  notifyDeadline: vi.fn(async () => 3),
}));

import { GET } from "@/app/api/cron/deadline-reminders/route";
import { notifyDeadline } from "@/lib/notifications";

const URL = "http://localhost:3000/api/cron/deadline-reminders";

function cronRequest(bearer?: string) {
  const req = getRequest(URL);
  if (bearer) req.headers.set("authorization", `Bearer ${bearer}`);
  return req;
}

/** ISO date whose getDaysRemaining() is exactly `days` (deadline is end-of-day). */
function deadlineInDays(days: number): string {
  return new Date(Date.now() + (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

afterEach(() => {
  holder.current = null;
  vi.mocked(notifyDeadline).mockClear();
});

describe("GET /api/cron/deadline-reminders", () => {
  it("rejects requests without the cron bearer token", async () => {
    holder.current = createMockSupabase();
    expect((await GET(cronRequest())).status).toBe(401);
    expect((await GET(cronRequest("wrong-secret"))).status).toBe(401);
    expect(holder.current.from).not.toHaveBeenCalled();
  });

  it("does nothing when there is no current word", async () => {
    holder.current = createMockSupabase({ tables: { words: { data: null } } });
    const res = await GET(cronRequest("test-cron-secret"));
    expect(res.status).toBe(200);
    expect((await res.json()).sent).toBe(0);
    expect(notifyDeadline).not.toHaveBeenCalled();
  });

  it("does nothing when the deadline is not 7 or 1 days away", async () => {
    holder.current = createMockSupabase({
      tables: {
        words: { data: { id: "w1", word: "hope", deadline: deadlineInDays(4) } },
      },
    });
    const res = await GET(cronRequest("test-cron-secret"));
    expect(res.status).toBe(200);
    expect((await res.json()).sent).toBe(0);
    expect(notifyDeadline).not.toHaveBeenCalled();
  });

  it("fans out the 7-day reminder", async () => {
    const word = { id: "w1", word: "hope", deadline: deadlineInDays(7) };
    holder.current = createMockSupabase({ tables: { words: { data: word } } });

    const res = await GET(cronRequest("test-cron-secret"));

    expect(res.status).toBe(200);
    expect((await res.json()).sent).toBe(3);
    expect(notifyDeadline).toHaveBeenCalledWith(word, 7);
  });

  it("fans out the 1-day reminder", async () => {
    const word = { id: "w1", word: "hope", deadline: deadlineInDays(1) };
    holder.current = createMockSupabase({ tables: { words: { data: word } } });

    await GET(cronRequest("test-cron-secret"));

    expect(notifyDeadline).toHaveBeenCalledWith(word, 1);
  });
});
