"use client";

import { useMemo, useState } from "react";
import PdfViewer from "./PdfViewerClient";
import Comments from "./Comments";
import { matchesTagQuery } from "@/lib/tags";
import { sortPapersByDate, sortOrderFor, type SortOrder } from "@/lib/papers";
import { SearchIcon } from "./icons";

type Paper = {
  id: string;
  submitted_at: string;
  publicUrl: string;
  // Nullable, not optional: the column is nullable and comes back as null.
  // matchesTagQuery already accepts null; only this type was narrower.
  tags?: string[] | null;
};

export default function PaperCarousel({
  papers,
  wordId,
  wordSlug,
  defaultNewestFirst = false,
}: {
  papers: Paper[];
  wordId: string;
  wordSlug: string;
  defaultNewestFirst?: boolean;
}) {
  const [query, setQuery] = useState("");
  // The word's own default decides which way the list opens; the reader can
  // flip it from here for the rest of the visit.
  const [order, setOrder] = useState<SortOrder>(() => sortOrderFor(defaultNewestFirst));
  const [index, setIndex] = useState(0);
  // Lazily-mounted PDF panes, tracked by paper id so filtering never mounts
  // the wrong document.
  const [activated, setActivated] = useState<Set<string>>(
    () =>
      new Set(
        sortPapersByDate(papers, sortOrderFor(defaultNewestFirst))
          .slice(0, 2)
          .map((p) => p.id)
      )
  );

  const ordered = useMemo(() => sortPapersByDate(papers, order), [papers, order]);

  // Hashtags are never displayed — the query only filters which papers show.
  const filtered = useMemo(
    () => ordered.filter((p) => matchesTagQuery(p.tags, query)),
    [ordered, query]
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

  // Both controls restart the reader at the top of the new list, so whatever
  // is on screen is always the first thing the list now offers.
  function restartWith(list: Paper[]) {
    setIndex(0);
    setActivated((prev) => {
      const set = new Set(prev);
      list.slice(0, 2).forEach((p) => set.add(p.id));
      return set;
    });
  }

  function onQueryChange(value: string) {
    setQuery(value);
    restartWith(ordered.filter((p) => matchesTagQuery(p.tags, value)));
  }

  function onOrderChange(next: SortOrder) {
    if (next === order) return;
    setOrder(next);
    restartWith(
      sortPapersByDate(papers, next).filter((p) => matchesTagQuery(p.tags, query))
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 flex-wrap sm:flex-nowrap">
        {/* Tag filter — matches invisible hashtags authors attached at submit time */}
        <div
          className="flex-1 min-w-0 flex items-center gap-2 px-4 py-2 rounded-sm"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--muted)",
          }}
        >
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Filter papers by hashtag"
            className="w-full min-w-0 text-sm bg-transparent"
            style={{
              color: "var(--ink)",
              fontFamily: "system-ui, sans-serif",
              outline: "none",
              border: "none",
            }}
          />
        </div>

        <div
          role="group"
          aria-label="Sort papers by date"
          className="flex shrink-0 rounded-sm overflow-hidden"
          style={{ border: "1px solid var(--border)", fontFamily: "system-ui, sans-serif" }}
        >
          {(
            [
              ["newest", "Newest first"],
              ["oldest", "Oldest first"],
            ] as const
          ).map(([value, label]) => {
            const active = order === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onOrderChange(value)}
                aria-pressed={active}
                className="text-sm px-4 py-2 whitespace-nowrap"
                style={{
                  backgroundColor: active ? "var(--forest)" : "var(--card)",
                  color: active ? "#fff" : "var(--muted)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
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
