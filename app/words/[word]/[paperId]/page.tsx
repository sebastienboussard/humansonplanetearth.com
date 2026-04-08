import { notFound } from "next/navigation";
import { getWordBySlug } from "@/lib/words";

export default async function PaperPage({
  params,
}: {
  params: Promise<{ word: string; paperId: string }>;
}) {
  const { word, paperId } = await params;
  const entry = getWordBySlug(word);

  if (!entry) notFound();

  // TODO: fetch paper from Supabase by paperId
  // For now, show a placeholder
  void paperId;

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

      <div
        className="py-32 text-center rounded-sm"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          Paper viewer coming soon.
        </p>
      </div>
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
