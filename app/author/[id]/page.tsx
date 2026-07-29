import Link from "next/link";
import { getAdminClient } from "@/lib/supabase";
import { getMonthName } from "@/lib/words";

export const revalidate = 300;

export const metadata = {
  title: "Papers by a Human On Planet Earth — Humans on Planet Earth",
};

type AuthorPaper = {
  paper_id: string;
  papers: {
    id: string;
    title: string | null;
    type: string;
    status: string;
    words: { word: string; month: number; year: number } | null;
  } | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Only papers the owner explicitly made visible, and only approved ones.
  // The admin client is required here because paper_authors is invisible to
  // the anon key — nothing else on this page touches private data.
  let entries: AuthorPaper[] = [];
  if (UUID_RE.test(id)) {
    const admin = getAdminClient();
    const { data } = await admin
      .from("paper_authors")
      .select(
        "paper_id, papers(id, title, type, status, words(word, month, year))"
      )
      .eq("profile_id", id)
      .eq("public_visible", true);
    entries = ((data ?? []) as AuthorPaper[]).filter(
      (e) => e.papers && e.papers.status === "approved"
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <p
        className="text-xs uppercase tracking-widest mb-4"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        Anonymous Author
      </p>
      <h1 className="text-4xl font-normal mb-10" style={{ color: "var(--forest)" }}>
        Papers by a Human On Planet Earth
      </h1>

      {/* Unknown ids and empty profiles render identically — this page never
          confirms whether a profile exists. */}
      {entries.length === 0 ? (
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          This human hasn&apos;t shared any papers yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => {
            const paper = entry.papers!;
            const href =
              paper.type === "long-form"
                ? `/long-form/${paper.id}`
                : `/words/${paper.words?.word}/${paper.id}`;
            return (
              <li
                key={entry.paper_id}
                className="rounded-sm p-4"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
              >
                <Link href={href} className="block hover:opacity-80 transition-opacity">
                  <p className="text-base" style={{ color: "var(--forest)" }}>
                    {paper.title ||
                      (paper.words
                        ? `On “${paper.words.word}”`
                        : "Untitled paper")}
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
                  >
                    {paper.type === "long-form"
                      ? "Long-form"
                      : paper.words
                        ? `${paper.words.word} · ${getMonthName(paper.words.month)} ${paper.words.year}`
                        : "Word paper"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
