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
      `Make one page on what it means to you — written, drawn, or anything else — and submit it by ${deadline}:`,
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

function adminFooter(tab: "pending" | "messages" | "rooms"): string {
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

// A page written in a Reading Room (TODO §21), waiting for review. Carries the
// room and section names only, never the page text or anything about who wrote
// it.
export function adminNewRoomPageEmail(page: { room: string; section: string }): EmailContent {
  return {
    subject: `New page in a Reading Room: ${page.room}`,
    text: [
      `A new page on "${page.section}" in the Reading Room "${page.room}" is waiting for review.`,
      adminFooter("rooms"),
    ].join("\n"),
  };
}

// A visitor without an account asking for a Reading Room (TODO §21). Carries
// the work's title only, never the requester's email.
export function adminRoomRequestEmail(request: { title: string }): EmailContent {
  return {
    subject: `Reading Room requested: ${request.title}`,
    text: [
      `Someone without an account has asked for a Reading Room on "${request.title}". It is hidden until you open it.`,
      adminFooter("rooms"),
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

// ---- Room requests ----
// The one reply to a visitor who asked for a Reading Room and left an email
// (TODO §21). They have no account and no profile, so there is no footer()
// and nothing to unsubscribe from: this is the only email they will get, and
// the address is deleted once it is sent.

export function roomRequestOpenedEmail(room: { title: string; slug: string }): EmailContent {
  return {
    subject: `Your Reading Room is open: ${room.title}`,
    text: [
      `The Reading Room you asked for, "${room.title}", is now open:`,
      `${siteUrl()}/rooms/${room.slug}`,
      "",
      "Anyone can write in it. This is the only email you will get about it.",
    ].join("\n"),
  };
}

export function roomRequestDeclinedEmail(room: { title: string }): EmailContent {
  return {
    subject: `Your Reading Room request: ${room.title}`,
    text: [
      `Thank you for asking for a Reading Room on "${room.title}". It won't be opened this time.`,
      "",
      `You can always open a room yourself with an account: ${siteUrl()}/rooms/new`,
      "This is the only email you will get about it.",
    ].join("\n"),
  };
}
