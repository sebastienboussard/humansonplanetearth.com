"use client";

import { useEffect, useState } from "react";

type Paper = {
  id: string;
  type: string;
  title: string | null;
  pdf_url: string;
  submitted_at: string;
  signed_url: string | null;
  words: { word: string; month: number; year: number } | null;
};

export default function ReviewQueue() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/review");
    const data = await res.json();
    const sorted = (data.papers ?? []).sort((a: Paper, b: Paper) =>
      (a.words?.word ?? a.title ?? "").localeCompare(b.words?.word ?? b.title ?? "")
    );
    setPapers(sorted);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function decide(id: string, status: "approved" | "rejected") {
    setActing(id);
    await fetch("/api/admin/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setPapers((prev) => prev.filter((p) => p.id !== id));
    setActing(null);
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
        className="py-16 text-center rounded-sm"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p className="text-base" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          No pending papers.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-6">
      {papers.map((paper) => (
        <li
          key={paper.id}
          className="rounded-sm p-6"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-lg font-normal mb-1" style={{ color: "var(--forest)" }}>
                {paper.type === "long-form" && paper.title
                  ? paper.title
                  : paper.words?.word ?? "Unknown word"}
              </p>
              <p
                className="text-xs"
                style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
              >
                {paper.type === "long-form" ? "Long-form" : `Word · ${paper.words?.word}`}
                {" · "}
                {new Date(paper.submitted_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div className="flex gap-3 items-center shrink-0">
              {paper.signed_url && (
                <a
                  href={paper.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline underline-offset-4"
                  style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
                >
                  View PDF
                </a>
              )}
              <button
                onClick={() => decide(paper.id, "approved")}
                disabled={acting === paper.id}
                className="px-4 py-2 text-sm text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--forest)", fontFamily: "system-ui, sans-serif" }}
              >
                Approve
              </button>
              <button
                onClick={() => decide(paper.id, "rejected")}
                disabled={acting === paper.id}
                className="px-4 py-2 text-sm disabled:opacity-50"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
