import { getWordBySlug, getMonthName } from "@/lib/words";
import SubmitForm from "../SubmitForm";

export const revalidate = 3600;

export const metadata = {
  title: "Submit — Humans on Planet Earth",
};

export default async function SubmitWordPage({
  params,
}: {
  params: Promise<{ word: string }>;
}) {
  const { word: slug } = await params;
  const entry = await getWordBySlug(slug);

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-normal mb-2" style={{ color: "var(--forest)" }}>
        Submit a Paper
      </h1>

      {entry ? (
        <>
          <p
            className="text-sm mb-10"
            style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
          >
            Word:{" "}
            <span style={{ color: "var(--forest)", fontWeight: 600 }}>{entry.word}</span>
            {" · "}
            {getMonthName(entry.month)} {entry.year}
          </p>
          <SubmitForm word={entry.word} />
        </>
      ) : (
        <p
          className="text-sm mt-6"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
        >
          Word not found.
        </p>
      )}

      <div
        className="mt-12 pt-8 space-y-2 text-sm"
        style={{ borderTop: "1px solid var(--border)", fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        <p><strong style={{ color: "var(--ink)" }}>Format:</strong> PDF only · 1 page max · 2 MB max</p>
        <p><strong style={{ color: "var(--ink)" }}>Privacy:</strong> No account required — you can submit with zero identifying information. If you sign in, you may optionally attach your paper to your anonymous profile (private by default).</p>
        <p><strong style={{ color: "var(--ink)" }}>Authorship:</strong> All papers credited as <em>Human On Planet Earth</em>.</p>
        <p><strong style={{ color: "var(--ink)" }}>Moderation:</strong> Reviewed before publishing. Everything welcome except spam and hate.</p>
      </div>
    </div>
  );
}
