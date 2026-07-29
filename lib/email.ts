import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

let resend: Resend | null = null;
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY!);
  return resend;
}

function fromAddress() {
  return process.env.NOTIFY_FROM_EMAIL ?? "HOPE <notify@humansonplanetearth.com>";
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    if (error) {
      console.error("Email send error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}

// Resend batch endpoint accepts up to 100 messages per call.
const BATCH_SIZE = 100;

export async function sendBatch(messages: EmailMessage[]): Promise<number> {
  const from = fromAddress();
  let sent = 0;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const chunk = messages.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await getResend().batch.send(
        chunk.map((m) => ({ from, to: m.to, subject: m.subject, text: m.text }))
      );
      if (error) {
        console.error("Email batch error:", error);
      } else {
        sent += chunk.length;
      }
    } catch (err) {
      console.error("Email batch error:", err);
    }
  }
  return sent;
}
