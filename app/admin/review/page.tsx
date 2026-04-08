import ReviewQueue from "./ReviewQueue";

export const metadata = { title: "Review — Admin" };

export default function ReviewPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex items-baseline justify-between mb-10">
        <h1 className="text-3xl font-normal" style={{ color: "var(--forest)" }}>
          Pending Papers
        </h1>
        <a
          href="/api/admin/logout"
          className="text-xs"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
        >
          Log out
        </a>
      </div>
      <ReviewQueue />
    </div>
  );
}
