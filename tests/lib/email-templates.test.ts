import { describe, expect, it } from "vitest";
import {
  newWordEmail,
  deadlineReminderEmail,
  paperCommentEmail,
  commentReplyEmail,
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
