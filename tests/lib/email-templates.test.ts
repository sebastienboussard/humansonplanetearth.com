import { describe, expect, it } from "vitest";
import {
  newWordEmail,
  deadlineReminderEmail,
  paperCommentEmail,
  commentReplyEmail,
  adminNewPaperEmail,
  adminNewMessageEmail,
} from "@/lib/email-templates";
import { unsubscribeUrl } from "@/lib/unsubscribe";

const PROFILE = "11111111-2222-3333-4444-555555555555";
const SITE = process.env.NEXT_PUBLIC_SITE_URL!;

describe("email templates", () => {
  it("new-word email links submit, unsubscribe (new_word) and account", () => {
    const { subject, text } = newWordEmail("hope", "August 31, 2026", PROFILE);
    expect(subject).toContain("hope");
    expect(text).toContain(`${SITE}/submit`);
    expect(text).toContain(unsubscribeUrl(PROFILE, "new_word"));
    expect(text).toContain(`${SITE}/account`);
  });

  it("deadline email says 'tomorrow' for 1 day and carries its unsubscribe link", () => {
    const { subject, text } = deadlineReminderEmail("hope", 1, PROFILE);
    expect(subject).toContain("tomorrow");
    expect(text).toContain(unsubscribeUrl(PROFILE, "deadline_reminders"));
  });

  it("deadline email counts days for 7 days out", () => {
    const { subject } = deadlineReminderEmail("hope", 7, PROFILE);
    expect(subject).toContain("in 7 days");
  });

  it("deadline email says two weeks rather than 14 days", () => {
    const { subject, text } = deadlineReminderEmail("hope", 14, PROFILE);
    expect(subject).toContain("in two weeks");
    expect(text).toContain("in two weeks");
  });

  it("paper-comment email carries the paper URL, excerpt and unsubscribe link", () => {
    const { text } = paperCommentEmail(`${SITE}/words/hope/p1`, "nice paper", PROFILE);
    expect(text).toContain(`${SITE}/words/hope/p1`);
    expect(text).toContain("nice paper");
    expect(text).toContain(unsubscribeUrl(PROFILE, "paper_comments"));
  });

  it("comment-reply email carries the page URL, excerpt and unsubscribe link", () => {
    const { text } = commentReplyEmail(`${SITE}/words/hope`, "i disagree", PROFILE);
    expect(text).toContain(`${SITE}/words/hope`);
    expect(text).toContain("i disagree");
    expect(text).toContain(unsubscribeUrl(PROFILE, "comment_replies"));
  });
});

// Admin alerts deep-link into the admin page and, unlike every reader email,
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
