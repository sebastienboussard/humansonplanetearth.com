"use client";

import { useState } from "react";
import PdfViewer from "./PdfViewer";
import Comments from "./Comments";

type Paper = {
  id: string;
  submitted_at: string;
  publicUrl: string;
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
  const [index, setIndex] = useState(0);
  const [activated, setActivated] = useState<Set<number>>(() => new Set([0, 1]));

  if (papers.length === 0) return null;

  const total = papers.length;
  const current = papers[index];

  function goTo(next: number) {
    setIndex(next);
    setActivated((prev) => new Set([...prev, next + 1]));
  }

  return (
    <div>
      <div
        className="flex items-center justify-between mb-4 flex-wrap gap-2"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="text-sm disabled:opacity-30 hover:underline underline-offset-4"
            style={{ color: "var(--forest)" }}
          >
            ← Prev
          </button>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            {index + 1} / {total}
          </span>
          <button
            onClick={() => goTo(index + 1)}
            disabled={index === total - 1}
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

      {papers.map((paper, i) =>
        activated.has(i) ? (
          <div key={paper.id} style={{ display: i === index ? "block" : "none" }}>
            <PdfViewer
              src={paper.publicUrl}
              title={`Paper ${i + 1}`}
              height="75vh"
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
    </div>
  );
}
