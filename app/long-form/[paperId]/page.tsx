import { notFound } from "next/navigation";
import { getAdminClient } from "@/lib/supabase";
import Comments from "@/components/Comments";

export default async function LongFormPaperPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { paperId } = await params;
  const admin = getAdminClient();

  const { data: paper } = await admin
    .from("papers")
    .select("id, title, pdf_url, submitted_at, status")
    .eq("id", paperId)
    .eq("type", "long-form")
    .eq("status", "approved")
    .single();

  if (!paper) notFound();

  const { data: signed } = await admin.storage
    .from("papers")
    .createSignedUrl(paper.pdf_url, 60 * 60);

  // Long-form papers have no word_id — use paper id as a stable comment anchor
  // by fetching the word_id from a dedicated "long-form" word row, or skip word-level comments.
  // We use a workaround: store comments with a synthetic word lookup via the paper itself.
  // For now, comments are scoped to the paper via a shared long-form word row.
  const { data: longFormWord } = await admin
    .from("words")
    .select("id")
    .eq("word", "__long-form__")
    .maybeSingle();

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <p
        className="text-xs uppercase tracking-widest mb-4"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        <a href="/long-form" style={{ color: "var(--muted)" }}>Long-Form</a> / paper
      </p>

      <h1
        className="text-4xl font-normal mb-3 leading-tight"
        style={{ color: "var(--forest)" }}
      >
        {paper.title}
      </h1>

      <p
        className="text-sm mb-8"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        Human On Planet Earth ·{" "}
        {new Date(paper.submitted_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      {signed?.signedUrl ? (
        <iframe
          src={signed.signedUrl}
          className="w-full rounded-sm"
          style={{ height: "80vh", border: "1px solid var(--border)" }}
          title={paper.title ?? "Paper"}
        />
      ) : (
        <div
          className="py-32 text-center rounded-sm"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
            Unable to load paper. Please try again.
          </p>
        </div>
      )}

      {longFormWord && (
        <Comments
          wordId={longFormWord.id}
          paperId={paper.id}
          title="Discussion"
          placeholder="Write a comment…"
        />
      )}
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { paperId } = await params;
  const admin = getAdminClient();
  const { data: paper } = await admin
    .from("papers")
    .select("title")
    .eq("id", paperId)
    .single();

  return {
    title: paper?.title
      ? `${paper.title} — Humans on Planet Earth`
      : "Long-Form Paper — Humans on Planet Earth",
  };
}
