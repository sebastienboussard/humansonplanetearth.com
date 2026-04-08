import Link from "next/link";
import { getAllWords, getMonthName } from "@/lib/words";

export const metadata = {
  title: "Words — Humans on Planet Earth",
};

export default function WordsPage() {
  const words = getAllWords();

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1
        className="text-4xl font-normal mb-2"
        style={{ color: "var(--forest)" }}
      >
        Words
      </h1>
      <p
        className="text-sm mb-12"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        Every word, every month.
      </p>

      {words.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No past words yet.</p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {words.map((entry) => (
            <li key={`${entry.year}-${entry.month}`}>
              <Link
                href={`/words/${entry.word}`}
                className="flex items-baseline justify-between py-5 group"
              >
                <span
                  className="text-2xl font-normal group-hover:underline underline-offset-4"
                  style={{ color: "var(--forest)" }}
                >
                  {entry.word}
                </span>
                <span
                  className="text-sm"
                  style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
                >
                  {getMonthName(entry.month)} {entry.year}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
