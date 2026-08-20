import { getWordBySlug, getMonthName } from "@/lib/words";
import SubmitForm from "../SubmitForm";
import SubmitTerms from "@/components/SubmitTerms";

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

      <SubmitTerms />
    </div>
  );
}
