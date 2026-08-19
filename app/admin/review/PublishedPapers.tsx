"use client";

import { useMemo, useState } from "react";
import { useAdminData } from "./AdminData";
import { filterPapers, paperLabel } from "@/lib/admin-queue";

export default function PublishedPapers() {
  const { published, loading, removePublished } = useAdminData();
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  // The provider keeps the list newest-first; the search narrows it by word
  // or title so one paper can be found in a history that only grows.
  const visible = useMemo(() => filterPapers(published, query), [published, query]);

  async function remove(id: string) {
    if (!confirm("Permanently delete this paper and its PDF? This cannot be undone.")) return;
    setRemoving(id);
    await removePublished(id);
    setRemoving(null);
  }

  if (loading.published) {
    return (
      <p className="text-sm italic" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
        Loading…
      </p>
    );
  }

  if (published.length === 0) {
    return (
      <div
        className="py-12 text-center rounded-sm"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p className="text-base" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          No published papers.
        </p>
      </div>
    );
  }

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by word or title…"
        aria-label="Search published papers"
        className="w-full px-4 py-2 mb-4 rounded-sm text-sm"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--ink)",
          fontFamily: "system-ui, sans-serif",
          outline: "none",
        }}
      />

      {visible.length === 0 ? (
        <p
          className="py-12 text-center text-sm"
          style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
        >
          No published papers match “{query.trim()}”.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((paper) => (
            <li
              key={paper.id}
              className="flex items-center justify-between gap-4 px-5 py-4 rounded-sm flex-wrap"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div>
                <p className="text-base font-normal" style={{ color: "var(--forest)" }}>
                  {paperLabel(paper)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
                  {paper.type === "long-form" ? "Long-form" : `Word · ${paper.words?.word}`}
                  {" · "}
                  {new Date(paper.submitted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {paper.signed_url && (
                  <a
                    href={paper.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline underline-offset-4"
                    style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
                  >
                    View PDF
                  </a>
                )}
                <button
                  onClick={() => remove(paper.id)}
                  disabled={removing === paper.id}
                  className="text-sm disabled:opacity-50"
                  style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
                >
                  {removing === paper.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
