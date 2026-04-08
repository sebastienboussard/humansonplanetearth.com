import { notFound } from "next/navigation";
import { getWordBySlug } from "@/lib/words";
import { getAdminClient } from "@/lib/supabase";
import Comments from "@/components/Comments";

export default async function PaperPage({
  params,
}: {
  params: Promise<{ word: string; paperId: string }>;
}) {
  const { word, paperId } = await params;
  const entry = await getWordBySlug(word);

  if (!entry) notFound();

  const admin = getAdminClient();

  const { data: paper } = await admin
    .from("papers")
    .select("id, word_id, pdf_url, submitted_at, status")
    .eq("id", paperId)
    .eq("status", "approved")
    .single();

  if (!paper) notFound();

  const { data: signed } = await admin.storage
    .from("papers")
    .createSignedUrl(paper.pdf_url, 60 * 60); // 1 hour

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <p
        className="text-xs uppercase tracking-widest mb-4"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        <a href={`/words/${entry.word}`} style={{ color: "var(--muted)" }}>
          {entry.word}
        </a>{" "}
        / paper
      </p>

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
          title="Paper"
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

      {paper.word_id && (
        <Comments wordId={paper.word_id} paperId={paper.id} />
      )}
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ word: string; paperId: string }>;
}) {
  const { word } = await params;
  return {
    title: `Paper — ${word} — Humans on Planet Earth`,
  };
}
