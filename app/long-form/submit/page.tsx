export const metadata = {
  title: "Submit Long-Form — Humans on Planet Earth",
};

export default function LongFormSubmitPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-normal mb-4" style={{ color: "var(--forest)" }}>
        Submit a Long-Form Paper
      </h1>
      <p
        className="text-sm mb-10"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        Any length. Any topic. Any time.
      </p>

      <div
        className="rounded-sm p-8 text-center"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p className="text-base mb-2" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          Submissions are coming soon.
        </p>
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          The submission system is currently being built.
        </p>
      </div>

      <div className="mt-10 space-y-3 text-sm" style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}>
        <p><strong style={{ color: "var(--ink)" }}>Format:</strong> PDF only, no page limit, 10MB max.</p>
        <p><strong style={{ color: "var(--ink)" }}>Title:</strong> Required — you provide it.</p>
        <p><strong style={{ color: "var(--ink)" }}>Email:</strong> Required to prevent flooding. Never displayed.</p>
        <p><strong style={{ color: "var(--ink)" }}>Authorship:</strong> Published as <em>Human On Planet Earth</em>.</p>
      </div>
    </div>
  );
}
