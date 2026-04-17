import { notFound } from "next/navigation";
import Link from "next/link";
import { getWordBySlug, getMonthName, getDaysRemaining, formatDeadline } from "@/lib/words";
import { getAdminClient } from "@/lib/supabase";
import Comments from "@/components/Comments";
import PdfViewer from "@/components/PdfViewer";

export const revalidate = 60;

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

  const papers = (
    await admin
      .from("papers")
      .select("id, submitted_at, pdf_url")
      .eq("word_id", entry.id)
      .eq("status", "approved")
      .order("submitted_at", { ascending: true })
  ).data ?? [];

  const papersWithUrls = papers.map((paper: any) => ({
    ...paper,
    publicUrl: admin.storage.from("papers").getPublicUrl(paper.pdf_url).data.publicUrl,
  }));

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
          {papersWithUrls.map((paper: any, i: number) => (
            <section key={paper.id}>
              <p
                className="text-sm mb-4"
                style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
              >
                Human On Planet Earth ·{" "}
                {new Date(paper.submitted_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>

              {paper.publicUrl ? (
                <PdfViewer
                  src={paper.publicUrl}
                  title={`Paper ${i + 1}`}
                  height="75vh"
                  paperNumber={i + 1}
                  paperHref={`/words/${entry.word}/${paper.id}`}
                />
              ) : (
                <div
                  className="py-20 text-center rounded-sm"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <p className="text-sm italic" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
                    Unable to load paper.{" "}
                    <Link
                      href={`/words/${entry.word}/${paper.id}`}
                      style={{ color: "var(--terracotta)" }}
                      className="underline underline-offset-4"
                    >
                      Try the full page →
                    </Link>
                  </p>
                </div>
              )}

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
