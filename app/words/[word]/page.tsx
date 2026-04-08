import { notFound } from "next/navigation";
import Link from "next/link";
import { getWordBySlug, getMonthName, getDaysRemaining, formatDeadline } from "@/lib/words";

export default async function WordPage({
  params,
}: {
  params: Promise<{ word: string }>;
}) {
  const { word } = await params;
  const entry = getWordBySlug(word);

  if (!entry) notFound();

  const daysLeft = getDaysRemaining(entry.deadline);
  const isOpen = daysLeft > 0;

  // TODO: fetch approved papers from Supabase
  const papers: { id: string; submitted_at: string }[] = [];

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

        {isOpen && (
          <Link
            href="/submit"
            className="text-sm px-6 py-2 text-white shrink-0"
            style={{
              backgroundColor: "var(--terracotta)",
              fontFamily: "system-ui, sans-serif",
              letterSpacing: "0.04em",
            }}
          >
            Submit a paper
          </Link>
        )}
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
          className="text-sm mb-10 italic"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
        >
          Submissions closed · {formatDeadline(entry.deadline)}
        </p>
      )}

      <hr style={{ borderColor: "var(--border)" }} className="mb-10" />

      {/* Papers */}
      {papers.length === 0 ? (
        <div className="py-16 text-center" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          <p className="text-base mb-1">No papers published yet.</p>
          {isOpen && (
            <p className="text-sm italic">
              Be the first.{" "}
              <Link href="/submit" style={{ color: "var(--terracotta)" }} className="underline underline-offset-4">
                Submit one →
              </Link>
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {papers.map((paper, i) => (
            <li key={paper.id}>
              <Link
                href={`/words/${entry.word}/${paper.id}`}
                className="block p-5 rounded-sm group hover:border-current transition-colors"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                <p
                  className="text-base group-hover:underline underline-offset-4"
                  style={{ color: "var(--forest)" }}
                >
                  Paper {i + 1}
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
                >
                  Human On Planet Earth ·{" "}
                  {new Date(paper.submitted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* General comments placeholder */}
      <div className="mt-16">
        <h2 className="text-xl font-normal mb-6" style={{ color: "var(--forest)" }}>
          Discussion
        </h2>
        <div
          className="py-10 text-center rounded-sm"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm italic" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
            Comments are coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ word: string }>;
}) {
  const { word } = await params;
  const entry = getWordBySlug(word);
  if (!entry) return {};
  return {
    title: `${entry.word} — Humans on Planet Earth`,
    description: `Read what humans wrote about "${entry.word}" — ${getMonthName(entry.month)} ${entry.year}.`,
  };
}
