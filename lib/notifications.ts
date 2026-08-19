import { getAdminClient } from "@/lib/supabase";
import { sendEmail, sendBatch, type EmailMessage } from "@/lib/email";
import {
  newWordEmail,
  deadlineReminderEmail,
  paperCommentEmail,
  commentReplyEmail,
} from "@/lib/email-templates";
import { formatDeadline } from "@/lib/words";

type WordRow = { id: string; word: string; deadline: string };

/** Days before the deadline a reminder can go out. */
export const DEADLINE_WINDOWS = [14, 7, 1] as const;
export type DeadlineWindow = (typeof DEADLINE_WINDOWS)[number];

export function isDeadlineWindow(days: number): days is DeadlineWindow {
  return (DEADLINE_WINDOWS as readonly number[]).includes(days);
}
type CommentRow = { id: string; body: string };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://humansonplanetearth.com";
}

function excerpt(body: string): string {
  return body.length > 200 ? `${body.slice(0, 200)}…` : body;
}

/**
 * Claim-then-send dedupe: unique (profile_id, kind, ref_id) on notification_log
 * means only the first claim wins — reruns and retries never double-send.
 */
async function claim(profileId: string, kind: string, refId: string | null): Promise<boolean> {
  const admin = getAdminClient();
  const { error } = await admin
    .from("notification_log")
    .insert({ profile_id: profileId, kind, ref_id: refId });
  return !error; // unique violation (or any failure) = do not send
}

type Subscriber = { profileId: string; email: string };

/**
 * All subscribers with every given pref enabled. Deadline reminders pass two —
 * the master switch and the specific window — so turning either off is enough
 * to stop the mail.
 */
async function subscribers(...prefs: string[]): Promise<Subscriber[]> {
  const admin = getAdminClient();
  let query = admin.from("notification_prefs").select("profile_id, profiles(id, email)");
  for (const pref of prefs) query = query.eq(pref, true);
  const { data, error } = await query;
  if (error) {
    console.error("Subscriber lookup error:", error);
    return [];
  }
  return (data ?? [])
    .map((row: { profile_id: string; profiles: { email: string } | null }) => ({
      profileId: row.profile_id,
      email: row.profiles?.email,
    }))
    .filter((s: { email?: string }): s is Subscriber => Boolean(s.email));
}

/** The single subscribed owner of a paper/comment, or null. */
async function ownerSubscriber(
  linkTable: "paper_authors" | "comment_authors",
  idColumn: "paper_id" | "comment_id",
  id: string,
  pref: string
): Promise<Subscriber | null> {
  const admin = getAdminClient();
  const { data: link } = await admin
    .from(linkTable)
    .select("profile_id")
    .eq(idColumn, id)
    .maybeSingle();
  if (!link) return null;

  const { data: prefs } = await admin
    .from("notification_prefs")
    .select(`${pref}, profiles(id, email)`)
    .eq("profile_id", link.profile_id)
    .maybeSingle();
  if (!prefs || !prefs[pref] || !prefs.profiles?.email) return null;

  return { profileId: link.profile_id, email: prefs.profiles.email };
}

export async function notifyNewWord(word: WordRow): Promise<void> {
  try {
    const subs = await subscribers("new_word");
    const messages: EmailMessage[] = [];
    for (const sub of subs) {
      if (!(await claim(sub.profileId, "new_word", word.id))) continue;
      const { subject, text } = newWordEmail(word.word, formatDeadline(word.deadline), sub.profileId);
      messages.push({ to: sub.email, subject, text });
    }
    if (messages.length > 0) await sendBatch(messages);
  } catch (err) {
    console.error("notifyNewWord error:", err);
  }
}

export async function notifyDeadline(
  word: WordRow,
  daysLeft: DeadlineWindow
): Promise<number> {
  try {
    // The pref column and the notification_log kind share one name per window,
    // so a reminder can only be sent to someone who asked for that window.
    const kind = `deadline_${daysLeft}d`;
    const subs = await subscribers("deadline_reminders", kind);
    const messages: EmailMessage[] = [];
    for (const sub of subs) {
      if (!(await claim(sub.profileId, kind, word.id))) continue;
      const { subject, text } = deadlineReminderEmail(word.word, daysLeft, sub.profileId);
      messages.push({ to: sub.email, subject, text });
    }
    if (messages.length > 0) await sendBatch(messages);
    return messages.length;
  } catch (err) {
    console.error("notifyDeadline error:", err);
    return 0;
  }
}

/**
 * Email the owner of a paper about a new comment on it.
 * `commenterProfileId` suppresses self-notification for signed-in commenters.
 */
export async function notifyPaperComment(
  paperId: string,
  comment: CommentRow,
  commenterProfileId: string | null
): Promise<void> {
  try {
    const owner = await ownerSubscriber("paper_authors", "paper_id", paperId, "paper_comments");
    if (!owner || owner.profileId === commenterProfileId) return;
    if (!(await claim(owner.profileId, "paper_comment", comment.id))) return;

    const admin = getAdminClient();
    const { data: paper } = await admin
      .from("papers")
      .select("id, type, word_id")
      .eq("id", paperId)
      .maybeSingle();

    let paperUrl = `${siteUrl()}/long-form/${paperId}`;
    if (paper?.type === "word" && paper.word_id) {
      const { data: word } = await admin
        .from("words")
        .select("word")
        .eq("id", paper.word_id)
        .maybeSingle();
      if (word) paperUrl = `${siteUrl()}/words/${word.word}/${paperId}`;
    }

    const { subject, text } = paperCommentEmail(paperUrl, excerpt(comment.body), owner.profileId);
    await sendEmail({ to: owner.email, subject, text });
  } catch (err) {
    console.error("notifyPaperComment error:", err);
  }
}

/**
 * Email the author of a comment about a reply to it.
 * `replierProfileId` suppresses self-notification.
 */
export async function notifyCommentReply(
  parentCommentId: string,
  reply: CommentRow,
  wordId: string,
  paperId: string | null,
  replierProfileId: string | null
): Promise<void> {
  try {
    const owner = await ownerSubscriber(
      "comment_authors",
      "comment_id",
      parentCommentId,
      "comment_replies"
    );
    if (!owner || owner.profileId === replierProfileId) return;
    if (!(await claim(owner.profileId, "comment_reply", reply.id))) return;

    const admin = getAdminClient();
    const { data: word } = await admin
      .from("words")
      .select("word")
      .eq("id", wordId)
      .maybeSingle();

    let pageUrl = `${siteUrl()}/words`;
    if (paperId) {
      // Long-form paper pages live under /long-form; word papers under /words/[word].
      pageUrl =
        word && word.word !== "__long-form__"
          ? `${siteUrl()}/words/${word.word}/${paperId}`
          : `${siteUrl()}/long-form/${paperId}`;
    } else if (word) {
      pageUrl = `${siteUrl()}/words/${word.word}`;
    }

    const { subject, text } = commentReplyEmail(pageUrl, excerpt(reply.body), owner.profileId);
    await sendEmail({ to: owner.email, subject, text });
  } catch (err) {
    console.error("notifyCommentReply error:", err);
  }
}
