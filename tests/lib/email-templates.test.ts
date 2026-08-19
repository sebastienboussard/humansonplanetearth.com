import { describe, expect, it } from "vitest";
import { adminNewPaperEmail, adminNewMessageEmail } from "@/lib/email-templates";

const SITE = process.env.NEXT_PUBLIC_SITE_URL!;

// Admin alerts deep-link into the admin page and, unlike reader-facing email,
// must never carry an unsubscribe token — there is no profile behind them.
describe("admin alert templates", () => {
  it("word-paper alert names the word and links the pending tab", () => {
    const { subject, text } = adminNewPaperEmail({ type: "word", word: "regret", title: null });
    expect(subject).toContain("regret");
    expect(text).toContain(`${SITE}/admin/review#pending`);
    expect(text.toLowerCase()).not.toContain("unsubscribe");
  });

  it("long-form alert names the title", () => {
    const { subject, text } = adminNewPaperEmail({
      type: "long-form",
      word: null,
      title: "On Grief",
    });
    expect(subject).toContain("On Grief");
    expect(text).toContain("long-form");
  });

  it("paper alert only carries type and word/title — no tags, paths or ids", () => {
    const { text } = adminNewPaperEmail({ type: "word", word: "regret", title: null });
    expect(text).not.toContain("tags");
    expect(text).not.toContain(".pdf");
  });

  it("message alert carries the body, reply address and messages deep link", () => {
    const { text } = adminNewMessageEmail({
      body: "hello there",
      replyEmail: "reader@example.com",
    });
    expect(text).toContain("hello there");
    expect(text).toContain("reader@example.com");
    expect(text).toContain(`${SITE}/admin/review#messages`);
    expect(text.toLowerCase()).not.toContain("unsubscribe");
  });

  it("message alert says so when no reply address was left", () => {
    const { text } = adminNewMessageEmail({ body: "anon", replyEmail: null });
    expect(text).toContain("No reply address left.");
  });
});
