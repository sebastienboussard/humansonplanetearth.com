import Link from "next/link";

export const metadata = {
  title: "Long-Form — Humans on Planet Earth",
};

export default function LongFormPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-4xl font-normal" style={{ color: "var(--forest)" }}>
          Long-Form
        </h1>
        <Link
          href="/long-form/submit"
          className="text-sm underline underline-offset-4"
          style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
        >
          Submit a paper →
        </Link>
      </div>
      <p
        className="text-sm mb-12"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        Writing of any length, any topic, any time. No monthly word required.
      </p>

      <div
        className="py-16 text-center"
        style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
      >
        <p className="text-base mb-1">No papers yet.</p>
        <p className="text-sm italic">Be the first to submit something.</p>
      </div>
    </div>
  );
}
