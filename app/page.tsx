import Link from "next/link";
import { getCurrentWord, getMonthName, formatDeadline, getDaysRemaining } from "@/lib/words";

export const revalidate = 3600;

export default async function HomePage() {
  const current = await getCurrentWord();

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">

      {/* Hero */}
      <section className="text-center mb-20">
        <p
          className="text-xs uppercase tracking-widest mb-6"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
        >
          Word of the Month
        </p>

        {current ? (
          <>
            <h1
              className="text-7xl md:text-9xl font-normal mb-6 leading-none"
              style={{ color: "var(--forest)", letterSpacing: "-0.03em" }}
            >
              {current.word}
            </h1>
            <p
              className="text-sm mb-2"
              style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
            >
              {getMonthName(current.month)} {current.year}
            </p>

            <Countdown deadline={current.deadline} />

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/submit"
                className="px-8 py-3 text-sm text-white transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: "var(--terracotta)",
                  fontFamily: "system-ui, sans-serif",
                  letterSpacing: "0.05em",
                }}
              >
                Submit a Paper
              </Link>
              <Link
                href={`/words/${current.word}`}
                className="px-8 py-3 text-sm transition-colors border"
                style={{
                  borderColor: "var(--forest)",
                  color: "var(--forest)",
                  fontFamily: "system-ui, sans-serif",
                  letterSpacing: "0.05em",
                }}
              >
                Read Submissions
              </Link>
            </div>
          </>
        ) : (
          <p style={{ color: "var(--muted)" }}>No word selected for this month yet.</p>
        )}
      </section>

      <hr style={{ borderColor: "var(--border)" }} className="mb-16" />

      {/* About blurb */}
      <section className="max-w-2xl mx-auto text-center mb-20">
        <h2 className="text-2xl font-normal mb-6" style={{ color: "var(--forest)" }}>
          What is this?
        </h2>
        <p className="text-base leading-relaxed mb-4" style={{ color: "var(--ink)" }}>
          Each month, a word is chosen. Anyone can write up to one page about it — a reflection,
          a memory, a question, an argument. Save it as a PDF and submit it here.
        </p>
        <p className="text-base leading-relaxed mb-6" style={{ color: "var(--ink)" }}>
          All papers are published anonymously, credited only as{" "}
          <em>Human On Planet Earth</em>.
        </p>
        <Link
          href="/about"
          className="text-sm underline underline-offset-4"
          style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
        >
          Learn more →
        </Link>
      </section>

      <hr style={{ borderColor: "var(--border)" }} className="mb-16" />

      {/* Long-form teaser */}
      <section className="text-center">
        <h2 className="text-2xl font-normal mb-4" style={{ color: "var(--forest)" }}>
          Long-Form Writing
        </h2>
        <p
          className="text-base leading-relaxed mb-6 max-w-xl mx-auto"
          style={{ color: "var(--ink)" }}
        >
          Have more to say? The long-form section is open to any length, any topic, any time.
          No monthly constraint.
        </p>
        <Link
          href="/long-form"
          className="text-sm underline underline-offset-4"
          style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
        >
          Browse long-form papers →
        </Link>
      </section>

    </div>
  );
}

function Countdown({ deadline }: { deadline: string }) {
  const days = getDaysRemaining(deadline);
  const formatted = formatDeadline(deadline);

  if (days === 0) {
    return (
      <p
        className="text-sm italic mt-2"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--terracotta)" }}
      >
        Submissions closed.
      </p>
    );
  }

  return (
    <p
      className="text-sm mt-2"
      style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
    >
      {days} {days === 1 ? "day" : "days"} left to submit · deadline {formatted}
    </p>
  );
}
