"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { matchesTagQuery } from "@/lib/tags";
import { SearchIcon } from "@/components/icons";

type Paper = {
  id: string;
  title: string;
  submitted_at: string;
  tags?: string[];
};

// Hashtags are never displayed — the search box only filters which papers show.
export default function LongFormList({ papers }: { papers: Paper[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => papers.filter((p) => matchesTagQuery(p.tags, query)),
    [papers, query]
  );

  return (
    <div>
      {/* Tag filter — matches invisible hashtags authors attached at submit time */}
      <div
        className="mb-6 flex items-center gap-2 px-4 py-2 rounded-sm"
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
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter papers by hashtag"
          className="w-full text-sm bg-transparent"
          style={{
            color: "var(--ink)",
            fontFamily: "system-ui, sans-serif",
            outline: "none",
            border: "none",
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <p
          className="py-16 text-center text-sm"
          style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
        >
          No papers match that hashtag.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {filtered.map((paper) => (
            <li key={paper.id}>
              <Link
                href={`/long-form/${paper.id}`}
                className="flex items-baseline justify-between py-5 group gap-4"
              >
                <span
                  className="text-xl font-normal group-hover:underline underline-offset-4"
                  style={{ color: "var(--forest)" }}
                >
                  {paper.title}
                </span>
                <span
                  className="text-sm shrink-0"
                  style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
                >
                  {new Date(paper.submitted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
