import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => true),
  sendBatch: vi.fn(async (messages: unknown[]) => messages.length),
}));

import { sendEmail, sendBatch, type EmailMessage } from "@/lib/email";
import {
  notifyNewWord,
  notifyDeadline,
  notifyPaperComment,
  notifyCommentReply,
} from "@/lib/notifications";

const SITE = "https://test.humansonplanetearth.com";
const word = { id: "w1", word: "hope", deadline: "2026-08-31" };

function prefRow(profileId: string, email: string | null) {
  return { profile_id: profileId, profiles: email ? { id: profileId, email } : null };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  holder.current = null;
  vi.mocked(sendEmail).mockClear();
  vi.mocked(sendBatch).mockClear();
  vi.restoreAllMocks();
});

describe("notifyNewWord", () => {
  it("claims then batch-sends to every subscriber with an email", async () => {
    holder.current = createMockSupabase({
      tables: {
        notification_prefs: {
          data: [prefRow("p1", "a@test.example"), prefRow("p2", "b@test.example"), prefRow("p3", null)],
        },
        notification_log: [{ error: null }, { error: null }],
      },
    });

    await notifyNewWord(word);

    // p3 has no email and is filtered out before any claim.
    expect(holder.current.queries.filter((q) => q.table === "notification_log")).toHaveLength(2);
    expect(holder.current.query("notification_log", 0)!.insert).toHaveBeenCalledWith({
      profile_id: "p1",
      kind: "new_word",
      ref_id: "w1",
    });

    expect(sendBatch).toHaveBeenCalledTimes(1);
    const messages = vi.mocked(sendBatch).mock.calls[0][0] as EmailMessage[];
    expect(messages.map((m) => m.to)).toEqual(["a@test.example", "b@test.example"]);
    expect(messages[0].subject).toBe("New word: hope");
  });

  it("skips subscribers whose claim is already logged (dedupe on rerun)", async () => {
    holder.current = createMockSupabase({
      tables: {
        notification_prefs: {
          data: [prefRow("p1", "a@test.example"), prefRow("p2", "b@test.example")],
        },
        notification_log: [{ error: { message: "duplicate key" } }, { error: null }],
      },
    });

    await notifyNewWord(word);

    const messages = vi.mocked(sendBatch).mock.calls[0][0] as EmailMessage[];
    expect(messages.map((m) => m.to)).toEqual(["b@test.example"]);
  });

  it("sends nothing when the subscriber lookup fails", async () => {
    holder.current = createMockSupabase({
      tables: { notification_prefs: { error: { message: "boom" } } },
    });

    await notifyNewWord(word);

    expect(sendBatch).not.toHaveBeenCalled();
  });
});

describe("notifyDeadline", () => {
  it("logs the 7-day kind and returns the number of messages", async () => {
    holder.current = createMockSupabase({
      tables: {
        notification_prefs: { data: [prefRow("p1", "a@test.example")] },
        notification_log: { error: null },
      },
    });

    expect(await notifyDeadline(word, 7)).toBe(1);
    expect(holder.current.query("notification_log", 0)!.insert).toHaveBeenCalledWith({
      profile_id: "p1",
      kind: "deadline_7d",
      ref_id: "w1",
    });
  });

  it("logs the 1-day kind separately so both reminders can send", async () => {
    holder.current = createMockSupabase({
      tables: {
        notification_prefs: { data: [prefRow("p1", "a@test.example")] },
        notification_log: { error: null },
      },
    });

    await notifyDeadline(word, 1);

    expect(holder.current.query("notification_log", 0)!.insert).toHaveBeenCalledWith({
      profile_id: "p1",
      kind: "deadline_1d",
      ref_id: "w1",
    });
  });

  it("logs the 14-day kind, so all three windows can send for one word", async () => {
    holder.current = createMockSupabase({
      tables: {
        notification_prefs: { data: [prefRow("p1", "a@test.example")] },
        notification_log: { error: null },
      },
    });

    await notifyDeadline(word, 14);

    expect(holder.current.query("notification_log", 0)!.insert).toHaveBeenCalledWith({
      profile_id: "p1",
      kind: "deadline_14d",
      ref_id: "w1",
    });
  });

  it("filters on the master switch and the window column together", async () => {
    holder.current = createMockSupabase({
      tables: {
        notification_prefs: { data: [prefRow("p1", "a@test.example")] },
        notification_log: { error: null },
      },
    });

    await notifyDeadline(word, 14);

    const q = holder.current.query("notification_prefs", 0)!;
    expect(q.eq).toHaveBeenCalledWith("deadline_reminders", true);
    expect(q.eq).toHaveBeenCalledWith("deadline_14d", true);
  });

  it("returns 0 when everyone is already claimed", async () => {
    holder.current = createMockSupabase({
      tables: {
        notification_prefs: { data: [prefRow("p1", "a@test.example")] },
        notification_log: { error: { message: "duplicate key" } },
      },
    });

    expect(await notifyDeadline(word, 7)).toBe(0);
    expect(sendBatch).not.toHaveBeenCalled();
  });
});

describe("notifyPaperComment", () => {
  const comment = { id: "c1", body: "Loved this." };

  function ownerTables(overrides: Record<string, unknown> = {}) {
    return {
      paper_authors: { data: { profile_id: "owner" } },
      notification_prefs: {
        data: { paper_comments: true, profiles: { id: "owner", email: "owner@test.example" } },
      },
      notification_log: { error: null },
      ...overrides,
    };
  }

  it("emails the owner with the word-paper URL", async () => {
    holder.current = createMockSupabase({
      tables: ownerTables({
        papers: { data: { id: "paper1", type: "word", word_id: "w1" } },
        words: { data: { word: "hope" } },
      }),
    });

    await notifyPaperComment("paper1", comment, null);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const msg = vi.mocked(sendEmail).mock.calls[0][0];
    expect(msg.to).toBe("owner@test.example");
    expect(msg.text).toContain(`${SITE}/words/hope/paper1`);
    expect(msg.text).toContain('"Loved this."');
  });

  it("links long-form papers under /long-form", async () => {
    holder.current = createMockSupabase({
      tables: ownerTables({
        papers: { data: { id: "paper1", type: "long-form", word_id: null } },
      }),
    });

    await notifyPaperComment("paper1", comment, null);

    expect(vi.mocked(sendEmail).mock.calls[0][0].text).toContain(`${SITE}/long-form/paper1`);
  });

  it("never notifies the commenter about their own comment", async () => {
    holder.current = createMockSupabase({ tables: ownerTables() });

    await notifyPaperComment("paper1", comment, "owner");

    // Bails before claiming, so the dedupe slot stays free for a real comment.
    expect(holder.current.query("notification_log")).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("respects a disabled paper_comments pref", async () => {
    holder.current = createMockSupabase({
      tables: ownerTables({
        notification_prefs: {
          data: { paper_comments: false, profiles: { id: "owner", email: "owner@test.example" } },
        },
      }),
    });

    await notifyPaperComment("paper1", comment, null);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does nothing for papers with no attached profile", async () => {
    holder.current = createMockSupabase({ tables: { paper_authors: { data: null } } });

    await notifyPaperComment("paper1", comment, null);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not send when the claim loses (already notified)", async () => {
    holder.current = createMockSupabase({
      tables: ownerTables({ notification_log: { error: { message: "duplicate key" } } }),
    });

    await notifyPaperComment("paper1", comment, null);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("truncates long comment bodies to a 200-character excerpt", async () => {
    const body = "x".repeat(300);
    holder.current = createMockSupabase({
      tables: ownerTables({
        papers: { data: { id: "paper1", type: "long-form", word_id: null } },
      }),
    });

    await notifyPaperComment("paper1", { id: "c1", body }, null);

    const text = vi.mocked(sendEmail).mock.calls[0][0].text;
    expect(text).toContain(`"${"x".repeat(200)}…"`);
    expect(text).not.toContain("x".repeat(201));
  });
});

describe("notifyCommentReply", () => {
  const reply = { id: "r1", body: "I agree." };

  function ownerTables(overrides: Record<string, unknown> = {}) {
    return {
      comment_authors: { data: { profile_id: "owner" } },
      notification_prefs: {
        data: { comment_replies: true, profiles: { id: "owner", email: "owner@test.example" } },
      },
      notification_log: { error: null },
      ...overrides,
    };
  }

  it("links word papers under /words/[word]", async () => {
    holder.current = createMockSupabase({
      tables: ownerTables({ words: { data: { word: "hope" } } }),
    });

    await notifyCommentReply("parent1", reply, "w1", "paper1", null);

    const msg = vi.mocked(sendEmail).mock.calls[0][0];
    expect(msg.to).toBe("owner@test.example");
    expect(msg.text).toContain(`${SITE}/words/hope/paper1`);
  });

  it("maps the __long-form__ sentinel word to /long-form", async () => {
    holder.current = createMockSupabase({
      tables: ownerTables({ words: { data: { word: "__long-form__" } } }),
    });

    await notifyCommentReply("parent1", reply, "w1", "paper1", null);

    expect(vi.mocked(sendEmail).mock.calls[0][0].text).toContain(`${SITE}/long-form/paper1`);
  });

  it("links the word page when the comment is not on a paper", async () => {
    holder.current = createMockSupabase({
      tables: ownerTables({ words: { data: { word: "hope" } } }),
    });

    await notifyCommentReply("parent1", reply, "w1", null, null);

    const text = vi.mocked(sendEmail).mock.calls[0][0].text;
    expect(text).toContain(`${SITE}/words/hope`);
    expect(text).not.toContain(`${SITE}/words/hope/`);
  });

  it("never notifies the replier about their own reply", async () => {
    holder.current = createMockSupabase({ tables: ownerTables() });

    await notifyCommentReply("parent1", reply, "w1", "paper1", "owner");

    expect(holder.current.query("notification_log")).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("respects a disabled comment_replies pref", async () => {
    holder.current = createMockSupabase({
      tables: ownerTables({
        notification_prefs: {
          data: { comment_replies: false, profiles: { id: "owner", email: "owner@test.example" } },
        },
      }),
    });

    await notifyCommentReply("parent1", reply, "w1", "paper1", null);

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
