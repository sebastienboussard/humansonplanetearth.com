import { getCurrentWord, getDaysRemaining } from "@/lib/words";
import SubmitForm from "./SubmitForm";

export const metadata = {
  title: "Submit — Humans on Planet Earth",
};

export default function SubmitPage() {
  const current = getCurrentWord();
  const isOpen = current ? getDaysRemaining(current.deadline) > 0 : false;

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
          {!isOpen && (
            <span style={{ color: "var(--terracotta)" }}> · Submissions closed</span>
          )}
        </p>
      ) : (
        <p
          className="text-sm mb-10"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
        >
          No active word this month. Check back soon.
        </p>
      )}

      {current && isOpen ? (
        <SubmitForm word={current.word} />
      ) : (
        <div
          className="py-12 text-center rounded-sm"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-base mb-1" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
            {current ? "Submissions for this month are closed." : "No active word right now."}
          </p>
          <p className="text-sm italic" style={{ color: "var(--muted)" }}>
            Come back next month.
          </p>
        </div>
      )}

      <div
        className="mt-12 pt-8 space-y-2 text-sm"
        style={{ borderTop: "1px solid var(--border)", fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        <p><strong style={{ color: "var(--ink)" }}>Format:</strong> PDF only · 1 page max · 2 MB max</p>
        <p><strong style={{ color: "var(--ink)" }}>Email:</strong> Required to prevent duplicates. Never shown publicly.</p>
        <p><strong style={{ color: "var(--ink)" }}>Authorship:</strong> All papers credited as <em>Human On Planet Earth</em>.</p>
        <p><strong style={{ color: "var(--ink)" }}>Moderation:</strong> Reviewed before publishing. Everything welcome except spam and hate.</p>
      </div>
    </div>
  );
}
