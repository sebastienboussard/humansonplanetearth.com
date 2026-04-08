export const metadata = {
  title: "Donate — Humans on Planet Earth",
};

export default function DonatePage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <p
        className="text-xs uppercase tracking-widest mb-6"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        Support the Project
      </p>

      <h1 className="text-4xl font-normal mb-6" style={{ color: "var(--forest)" }}>
        Coming Soon
      </h1>

      <p className="text-base leading-relaxed mb-4" style={{ color: "var(--ink)" }}>
        A way to support Humans on Planet Earth is on its way.
      </p>
      <p className="text-base leading-relaxed" style={{ color: "var(--ink)" }}>
        For now, the best thing you can do is write something and submit it.
      </p>
    </div>
  );
}
