"use client";

import { useState } from "react";
import { useAdminData } from "./AdminData";
import { paperLabel } from "@/lib/admin-queue";

export default function ReviewQueue() {
  const { pending, loading, approve, reject } = useAdminData();
  const [acting, setActing] = useState<string | null>(null);

  async function decide(id: string, status: "approved" | "rejected") {
    setActing(id);
    await (status === "approved" ? approve(id) : reject(id));
    setActing(null);
  }

  if (loading.pending) {
    return (
      <p className="text-sm italic" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
        Loading…
      </p>
    );
  }

  if (pending.length === 0) {
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
      {pending.map((paper) => (
        <li
          key={paper.id}
          className="rounded-sm p-6"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-lg font-normal mb-1" style={{ color: "var(--forest)" }}>
                {paperLabel(paper)}
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
