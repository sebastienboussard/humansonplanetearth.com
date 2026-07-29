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
  const when = daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
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
