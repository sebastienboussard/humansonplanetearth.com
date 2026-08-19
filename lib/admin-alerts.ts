// Email alerts to the site's own inbox when there is admin work to do:
// a paper waiting for review, or a contact message. Fire-and-forget by
// design — an alert failure must never fail the visitor's request, so both
// functions swallow everything and resolve void.

import { sendEmail } from "@/lib/email";
import { adminNewMessageEmail, adminNewPaperEmail } from "@/lib/email-templates";

// Unset means alerts are off (dev, tests) — a silent no-op, not an error.
function adminAddress(): string | null {
  const to = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  return to ? to : null;
}

export async function notifyAdminNewPaper(paper: {
  type: "word" | "long-form";
  word: string | null;
  title: string | null;
}): Promise<void> {
  const to = adminAddress();
  if (!to) return;
  try {
    await sendEmail({ to, ...adminNewPaperEmail(paper) });
  } catch (err) {
    console.error("Admin paper alert error:", err);
  }
}

/** Resolves true only when the alert email was actually sent. */
export async function notifyAdminNewMessage(message: {
  body: string;
  replyEmail: string | null;
}): Promise<boolean> {
  const to = adminAddress();
  if (!to) return false;
  try {
    return await sendEmail({ to, ...adminNewMessageEmail(message) });
  } catch (err) {
    console.error("Admin message alert error:", err);
    return false;
  }
}
