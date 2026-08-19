import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => true),
}));

import { notifyAdminNewMessage, notifyAdminNewPaper } from "@/lib/admin-alerts";
import { sendEmail } from "@/lib/email";

const ADMIN_TO = "weare.HumansOnPlanetEarth@gmail.com";

beforeEach(() => {
  // tests/setup.ts leaves ADMIN_NOTIFY_EMAIL unset; opt in per test.
  vi.stubEnv("ADMIN_NOTIFY_EMAIL", ADMIN_TO);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(sendEmail).mockClear();
  vi.mocked(sendEmail).mockResolvedValue(true);
});

describe("notifyAdminNewPaper", () => {
  it("does nothing when ADMIN_NOTIFY_EMAIL is unset", async () => {
    vi.stubEnv("ADMIN_NOTIFY_EMAIL", "");
    await notifyAdminNewPaper({ type: "word", word: "regret", title: null });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("emails the admin address about a word paper", async () => {
    await notifyAdminNewPaper({ type: "word", word: "regret", title: null });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const message = vi.mocked(sendEmail).mock.calls[0][0];
    expect(message.to).toBe(ADMIN_TO);
    expect(message.subject).toContain("regret");
    expect(message.text).toContain("waiting for review");
    expect(message.text).toContain("/admin/review#pending");
  });

  it("uses the title for long-form papers", async () => {
    await notifyAdminNewPaper({ type: "long-form", word: null, title: "On Grief" });
    const message = vi.mocked(sendEmail).mock.calls[0][0];
    expect(message.subject).toContain("On Grief");
  });

  it("never includes an unsubscribe link — it is not a reader email", async () => {
    await notifyAdminNewPaper({ type: "word", word: "regret", title: null });
    const message = vi.mocked(sendEmail).mock.calls[0][0];
    expect(message.text.toLowerCase()).not.toContain("unsubscribe");
  });

  it("resolves even when sendEmail throws", async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("resend down"));
    await expect(
      notifyAdminNewPaper({ type: "word", word: "regret", title: null })
    ).resolves.toBeUndefined();
  });
});

describe("notifyAdminNewMessage", () => {
  it("returns false without sending when ADMIN_NOTIFY_EMAIL is unset", async () => {
    vi.stubEnv("ADMIN_NOTIFY_EMAIL", "");
    const sent = await notifyAdminNewMessage({ body: "hello", replyEmail: null });
    expect(sent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("carries the full body and reply address", async () => {
    const sent = await notifyAdminNewMessage({
      body: "I love this site",
      replyEmail: "reader@example.com",
    });

    expect(sent).toBe(true);
    const message = vi.mocked(sendEmail).mock.calls[0][0];
    expect(message.to).toBe(ADMIN_TO);
    expect(message.text).toContain("I love this site");
    expect(message.text).toContain("reader@example.com");
    expect(message.text).toContain("/admin/review#messages");
  });

  it("notes when no reply address was left", async () => {
    await notifyAdminNewMessage({ body: "anon note", replyEmail: null });
    const message = vi.mocked(sendEmail).mock.calls[0][0];
    expect(message.text).toContain("No reply address left.");
  });

  it("returns false when the send fails", async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce(false);
    const sent = await notifyAdminNewMessage({ body: "x", replyEmail: null });
    expect(sent).toBe(false);
  });

  it("returns false instead of throwing when sendEmail throws", async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("resend down"));
    await expect(notifyAdminNewMessage({ body: "x", replyEmail: null })).resolves.toBe(false);
  });
});
