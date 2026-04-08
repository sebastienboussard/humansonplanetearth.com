import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-32 text-center">
      <p
        className="text-xs uppercase tracking-widest mb-6"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        404
      </p>
      <h1 className="text-4xl font-normal mb-6" style={{ color: "var(--forest)" }}>
        Nothing here.
      </h1>
      <Link
        href="/"
        className="text-sm underline underline-offset-4"
        style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
      >
        ← Go home
      </Link>
    </div>
  );
}
