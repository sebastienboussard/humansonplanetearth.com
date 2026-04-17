import ReviewQueue from "./ReviewQueue";
import PublishedPapers from "./PublishedPapers";
import AddWordForm from "./AddWordForm";

export const metadata = { title: "Review — Admin" };

export default function ReviewPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex items-baseline justify-between mb-10">
        <h1 className="text-3xl font-normal" style={{ color: "var(--forest)" }}>
          Admin
        </h1>
        <a
          href="/api/admin/logout"
          className="text-xs"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
        >
          Log out
        </a>
      </div>

      <div className="mb-16">
        <h2 className="text-xl font-normal mb-6" style={{ color: "var(--forest)" }}>
          Pending Papers
        </h2>
        <ReviewQueue />
      </div>

      <div className="mb-16">
        <h2 className="text-xl font-normal mb-6" style={{ color: "var(--forest)" }}>
          Published Papers
        </h2>
        <PublishedPapers />
      </div>

      <AddWordForm />
    </div>
  );
}
