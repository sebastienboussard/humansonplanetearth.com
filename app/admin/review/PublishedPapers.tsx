"use client";

import { useEffect, useState } from "react";

type Paper = {
  id: string;
  type: string;
  title: string | null;
  submitted_at: string;
  signed_url: string;
  words: { word: string; month: number; year: number } | null;
};

export default function PublishedPapers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [attachInput, setAttachInput] = useState<Record<string, string>>({});
  const [attachStatus, setAttachStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/review?status=approved")
      .then((r) => r.json())
      .then((d) => {
        const sorted = (d.papers ?? []).sort((a: Paper, b: Paper) =>
          (a.words?.word ?? a.title ?? "").localeCompare(b.words?.word ?? b.title ?? "")
        );
        setPapers(sorted);
        setLoading(false);
      });
  }, []);

  async function remove(id: string) {
    if (!confirm("Permanently delete this paper and its PDF? This cannot be undone.")) return;
    setRemoving(id);
    await fetch("/api/admin/review", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPapers((prev) => prev.filter((p) => p.id !== id));
    setRemoving(null);
  }

  async function attach(paperId: string) {
    const profileId = attachInput[paperId]?.trim();
    if (!profileId) return;
    setAttaching(paperId);
    const res = await fetch("/api/admin/attach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId, profileId }),
    });
    const data = await res.json();
    setAttachStatus((s) => ({
      ...s,
      [paperId]: res.ok ? "Attached." : data.error ?? "Failed.",
    }));
    setAttaching(null);
  }

  if (loading) {
    return (
      <p className="text-sm italic" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
        Loading…
      </p>
    );
  }

  if (papers.length === 0) {
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
    <ul className="space-y-3">
      {papers.map((paper) => (
        <li
          key={paper.id}
          className="flex items-center justify-between gap-4 px-5 py-4 rounded-sm flex-wrap"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div>
            <p className="text-base font-normal" style={{ color: "var(--forest)" }}>
              {paper.type === "long-form" && paper.title
                ? paper.title
                : paper.words?.word ?? "Unknown word"}
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

          {/* Manual profile attachment for old papers */}
          <div className="w-full flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Profile id to attach"
              value={attachInput[paper.id] ?? ""}
              onChange={(e) =>
                setAttachInput((s) => ({ ...s, [paper.id]: e.target.value }))
              }
              className="flex-1 min-w-48 px-3 py-1.5 rounded-sm text-xs"
              style={{
                backgroundColor: "var(--background, #fff)",
                border: "1px solid var(--border)",
                color: "var(--ink)",
                fontFamily: "system-ui, sans-serif",
              }}
            />
            <button
              onClick={() => attach(paper.id)}
              disabled={attaching === paper.id || !attachInput[paper.id]?.trim()}
              className="text-xs underline underline-offset-4 disabled:opacity-40"
              style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
            >
              {attaching === paper.id ? "Attaching…" : "Attach to profile"}
            </button>
            {attachStatus[paper.id] && (
              <span className="text-xs" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
                {attachStatus[paper.id]}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
