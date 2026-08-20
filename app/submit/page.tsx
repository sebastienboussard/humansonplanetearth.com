import { getCurrentWord } from "@/lib/words";
import SubmitForm from "./SubmitForm";
import SubmitTerms from "@/components/SubmitTerms";

export const revalidate = 60;

export const metadata = {
  title: "Submit — Humans on Planet Earth",
};

export default async function SubmitPage() {
  const current = await getCurrentWord();

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <p
        className="text-xs uppercase tracking-widest mb-4"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        Word of the Month
      </p>
      <h1 className="text-4xl font-normal mb-2" style={{ color: "var(--forest)" }}>
        Submit a Paper
      </h1>

      {current ? (
        <p
          className="text-sm mb-10"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
        >
          This month&apos;s word:{" "}
          <span style={{ color: "var(--forest)", fontWeight: 600 }}>{current.word}</span>
        </p>
      ) : (
        <p
          className="text-sm mb-10"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
        >
          No active word this month. Check back soon.
        </p>
      )}

      {current ? (
        <SubmitForm word={current.word} />
      ) : (
        <div
          className="py-12 text-center rounded-sm"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-base mb-1" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
            No active word right now.
          </p>
          <p className="text-sm italic" style={{ color: "var(--muted)" }}>
            Come back next month.
          </p>
        </div>
      )}

      <SubmitTerms />
    </div>
  );
}
