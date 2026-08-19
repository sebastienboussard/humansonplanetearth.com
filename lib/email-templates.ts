export type EmailContent = { subject: string; text: string };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://humansonplanetearth.com";
}

// ---- Admin alerts ----
// These go to the site's own inbox, not to a reader, so they carry no
// unsubscribe link and no reader-facing footer.

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
