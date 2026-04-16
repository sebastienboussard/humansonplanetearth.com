import { notFound } from "next/navigation";
import Link from "next/link";
import { getWordBySlug, getMonthName, getDaysRemaining, formatDeadline } from "@/lib/words";
import { getAdminClient } from "@/lib/supabase";
import Comments from "@/components/Comments";

export const dynamic = "force-dynamic";

export default async function WordPage({
  params,
}: {
  params: Promise<{ word: string }>;
}) {
  const { word } = await params;
  const entry = await getWordBySlug(word);

  if (!entry) notFound();

  const daysLeft = getDaysRemaining(entry.deadline);
  const isOpen = daysLeft > 0;

  const admin = getAdminClient();

  // Fetch approved papers and generate signed URLs for inline preview
  const rawPapers = (
    await admin
      .from("papers")
      .select("id, pdf_url, submitted_at")
      .eq("word_id", entry.id)
      .eq("status", "approved")
      .order("submitted_at", { ascending: true })
  ).data ?? [];

  const papers = await Promise.all(
    rawPapers.map(async (p, i) => {
      const { data: signed } = await admin.storage
        .from("papers")
        .createSignedUrl(p.pdf_url, 60 * 60);
      return { ...p, signedUrl: signed?.signedUrl ?? null, index: i + 1 };
    })
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Header */}
      <p
        className="text-xs uppercase tracking-widest mb-4"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        {getMonthName(entry.month)} {entry.year}
      </p>

      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <h1
          className="text-6xl font-normal leading-none"
          style={{ color: "var(--forest)", letterSpacing: "-0.03em" }}
        >
          {entry.word}
        </h1>

        <Link
          href={isOpen ? "/submit" : `/submit/${entry.word}`}
          className="text-sm px-6 py-2 text-white shrink-0"
          style={{
            backgroundColor: "var(--terracotta)",
            fontFamily: "system-ui, sans-serif",
            letterSpacing: "0.04em",
          }}
        >
          Submit a paper
        </Link>
      </div>

      {isOpen ? (
        <p
          className="text-sm mb-10"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
        >
          {daysLeft} {daysLeft === 1 ? "day" : "days"} left · deadline {formatDeadline(entry.deadline)}
        </p>
      ) : (
        <p
          className="text-sm mb-10"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
        >
          Deadline passed · {formatDeadline(entry.deadline)}
          <span className="italic"> — but it&apos;s never too late to submit for fun.</span>
        </p>
      )}

      <hr style={{ borderColor: "var(--border)" }} className="mb-12" />

      {/* Papers */}
      {papers.length === 0 ? (
        <div className="py-16 text-center" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          <p className="text-base mb-1">No papers published yet.</p>
          <p className="text-sm italic">
            Be the first.{" "}
            <Link href={isOpen ? "/submit" : `/submit/${entry.word}`} style={{ color: "var(--terracotta)" }} className="underline underline-offset-4">
              Submit one →
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-16">
          {papers.map((paper) => (
            <section key={paper.id}>
              {/* Paper header */}
              <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
                <p
                  className="text-sm"
                  style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
                >
                  Human On Planet Earth ·{" "}
                  {new Date(paper.submitted_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <Link
                  href={`/words/${entry.word}/${paper.id}`}
                  className="text-sm underline underline-offset-4 shrink-0"
                  style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
                >
                  Full page →
                </Link>
              </div>

              {/* Inline PDF preview */}
              {paper.signedUrl ? (
                <iframe
                  src={paper.signedUrl}
                  className="w-full rounded-sm"
                  style={{ height: "70vh", border: "1px solid var(--border)" }}
                  title={`Paper ${paper.index}`}
                />
              ) : (
                <div
                  className="py-16 text-center rounded-sm"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <p className="text-sm" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
                    Unable to load preview.{" "}
                    <Link
                      href={`/words/${entry.word}/${paper.id}`}
                      className="underline underline-offset-4"
                      style={{ color: "var(--terracotta)" }}
                    >
                      View full page →
                    </Link>
                  </p>
                </div>
              )}

              {/* Paper-specific comments */}
              <Comments
                wordId={entry.id}
                paperId={paper.id}
                title="Discuss this paper"
                placeholder="Write a comment about this paper…"
              />

              <hr style={{ borderColor: "var(--border)" }} className="mt-16" />
            </section>
          ))}
        </div>
      )}

      {/* General word discussion */}
      <Comments
        wordId={entry.id}
        title="General discussion"
        placeholder={`Write a comment about "${entry.word}"…`}
      />
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ word: string }>;
}) {
  const { word } = await params;
  const entry = await getWordBySlug(word);
  if (!entry) return {};
  return {
    title: `${entry.word} — Humans on Planet Earth`,
    description: `Read what humans wrote about "${entry.word}" — ${getMonthName(entry.month)} ${entry.year}.`,
  };
}
