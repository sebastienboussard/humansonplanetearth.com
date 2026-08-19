import { unsubscribeUrl, type UnsubPref } from "@/lib/unsubscribe";

export type EmailContent = { subject: string; text: string };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://humansonplanetearth.com";
}

function footer(profileId: string, pref: UnsubPref): string {
  return [
    "",
    "—",
    `Unsubscribe from these emails: ${unsubscribeUrl(profileId, pref)}`,
    `Manage all notifications: ${siteUrl()}/account`,
  ].join("\n");
}

export function newWordEmail(
  word: string,
  deadline: string,
  profileId: string
): EmailContent {
  return {
    subject: `New word: ${word}`,
    text: [
      `The new word of the month is "${word}".`,
      "",
      `Write one page on what it means to you and submit it by ${deadline}:`,
      `${siteUrl()}/submit`,
      footer(profileId, "new_word"),
    ].join("\n"),
  };
}

export function deadlineReminderEmail(
  word: string,
  daysLeft: number,
  profileId: string
): EmailContent {
  const when =
    daysLeft === 1 ? "tomorrow" : daysLeft === 14 ? "in two weeks" : `in ${daysLeft} days`;
  return {
    subject: `"${word}" deadline ${when}`,
    text: [
      `The deadline for this month's word "${word}" is ${when}.`,
      "",
      `Submit your one-page paper:`,
      `${siteUrl()}/submit`,
      footer(profileId, "deadline_reminders"),
    ].join("\n"),
  };
}

export function paperCommentEmail(
  paperUrl: string,
  excerpt: string,
  profileId: string
): EmailContent {
  return {
    subject: "New comment on your paper",
    text: [
      "Someone commented on a paper attached to your profile:",
      "",
      `"${excerpt}"`,
      "",
      `Read and reply: ${paperUrl}`,
      footer(profileId, "paper_comments"),
    ].join("\n"),
  };
}

// ---- Admin alerts ----
// These go to the site's own inbox, not to a reader, so they take no
// profileId and must never use footer() — its unsubscribe link is signed
// against a reader profile that doesn't exist here.

function adminFooter(tab: "pending" | "messages"): string {
  return ["", "—", `Open the admin page: ${siteUrl()}/admin/review#${tab}`].join("\n");
}

// Carries only type and word/title — never tags, storage paths or profile ids.
export function adminNewPaperEmail(paper: {
  type: "word" | "long-form";
  word: string | null;
  title: string | null;
}): EmailContent {
  const label =
    paper.type === "long-form"
      ? `long-form paper "${paper.title ?? "Untitled"}"`
      : `paper for "${paper.word ?? "unknown word"}"`;
  return {
    subject: `New paper submitted: ${
      paper.type === "long-form" ? paper.title ?? "Untitled" : paper.word ?? "unknown word"
    }`,
    text: [
      `A new ${label} is waiting for review.`,
      adminFooter("pending"),
    ].join("\n"),
  };
}

export function adminNewMessageEmail(message: {
  body: string;
  replyEmail: string | null;
}): EmailContent {
  return {
    subject: "New contact message",
    text: [
      "Someone sent a message through the contact form:",
      "",
      message.body,
      "",
      message.replyEmail ? `Reply to: ${message.replyEmail}` : "No reply address left.",
      adminFooter("messages"),
    ].join("\n"),
  };
}

export function commentReplyEmail(
  pageUrl: string,
  excerpt: string,
  profileId: string
): EmailContent {
  return {
    subject: "Someone replied to your comment",
    text: [
      "Someone replied to a comment you made:",
      "",
      `"${excerpt}"`,
      "",
      `Read and reply: ${pageUrl}`,
      footer(profileId, "comment_replies"),
    ].join("\n"),
  };
}
