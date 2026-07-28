"use client";

import { useMemo, useState } from "react";
import PdfViewer from "./PdfViewer";
import Comments from "./Comments";
import { matchesTagQuery } from "@/lib/tags";

type Paper = {
  id: string;
  submitted_at: string;
  publicUrl: string;
  tags?: string[];
};

export default function PaperCarousel({
  papers,
  wordId,
  wordSlug,
}: {
  papers: Paper[];
  wordId: string;
  wordSlug: string;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  // Lazily-mounted PDF panes, tracked by paper id so filtering never mounts
  // the wrong document.
  const [activated, setActivated] = useState<Set<string>>(
    () => new Set(papers.slice(0, 2).map((p) => p.id))
  );

  // Hashtags are never displayed — the query only filters which papers show.
  const filtered = useMemo(
    () => papers.filter((p) => matchesTagQuery(p.tags, query)),
    [papers, query]
  );

  if (papers.length === 0) return null;

  const total = filtered.length;
  const safeIndex = Math.min(index, Math.max(0, total - 1));
  const current = filtered[safeIndex];

  function activate(paper: Paper | undefined) {
    if (paper) setActivated((prev) => new Set(prev).add(paper.id));
  }

  function goTo(next: number) {
    setIndex(next);
    activate(filtered[next + 1]);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setIndex(0);
    const next = papers.filter((p) => matchesTagQuery(p.tags, value));
    setActivated((prev) => {
      const set = new Set(prev);
      next.slice(0, 2).forEach((p) => set.add(p.id));
      return set;
    });
  }

  return (
    <div>
      {/* Tag filter — matches invisible hashtags authors attached at submit time */}
      <div className="mb-6">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter by hashtag…"
          aria-label="Filter papers by hashtag"
          className="w-full px-4 py-2 rounded-sm text-sm"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--ink)",
            fontFamily: "system-ui, sans-serif",
            outline: "none",
          }}
        />
      </div>

      {total === 0 ? (
        <p
          className="py-16 text-center text-sm"
          style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
        >
          No papers match that hashtag.
        </p>
      ) : (
        <>
          <div
            className="flex items-center justify-between mb-4 flex-wrap gap-2"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => goTo(safeIndex - 1)}
                disabled={safeIndex === 0}
                className="text-sm disabled:opacity-30 hover:underline underline-offset-4"
                style={{ color: "var(--forest)" }}
              >
                ← Prev
              </button>
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {safeIndex + 1} / {total}
              </span>
              <button
                onClick={() => goTo(safeIndex + 1)}
                disabled={safeIndex === total - 1}
                className="text-sm disabled:opacity-30 hover:underline underline-offset-4"
                style={{ color: "var(--forest)" }}
              >
                Next →
              </button>
            </div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Human On Planet Earth ·{" "}
              {new Date(current.submitted_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>

          {filtered.map((paper, i) =>
            activated.has(paper.id) ? (
              <div key={paper.id} style={{ display: i === safeIndex ? "block" : "none" }}>
                <PdfViewer
                  src={paper.publicUrl}
                  title={`Paper ${i + 1}`}
                  paperNumber={i + 1}
                  paperHref={`/words/${wordSlug}/${paper.id}`}
                />
              </div>
            ) : null
          )}

          <Comments
            wordId={wordId}
            paperId={current.id}
            title="Discuss this paper"
            placeholder="Write a comment about this paper…"
          />
        </>
      )}
    </div>
  );
}
