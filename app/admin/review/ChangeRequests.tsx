"use client";

import { useState } from "react";
import { useAdminData } from "./AdminData";
import { paperLabel } from "@/lib/admin-queue";

// Change requests (TODO §24): an author's replacement PDF for a paper attached
// to their account. Shown above the pending papers, and only when there is
// one — an empty section here would just be noise above the real queue.
export default function ChangeRequests() {
  const { edits, loading, decideEdit } = useAdminData();
  const [acting, setActing] = useState<string | null>(null);

  async function decide(id: string, decision: "apply" | "decline") {
    setActing(id);
    await decideEdit(id, decision);
    setActing(null);
  }

  if (loading.edits || edits.length === 0) return null;

  const sans = { fontFamily: "system-ui, sans-serif" } as const;
  const link = { ...sans, color: "var(--terracotta)" } as const;

  return (
    <section className="mb-12">
      <h2 className="text-xl mb-1" style={{ color: "var(--forest)" }}>
        Change requests
      </h2>
      <p className="text-xs mb-4" style={{ ...sans, color: "var(--muted)" }}>
        Authors asking to replace a paper&apos;s PDF. Nothing changes on the site until you apply
        it; the old file is removed when you do.
      </p>
      <ul className="space-y-6">
        {edits.map((edit) => (
          <li
            key={edit.id}
            className="rounded-sm p-6"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-lg font-normal mb-1" style={{ color: "var(--forest)" }}>
                  {paperLabel(edit.paper)}
                </p>
                <p className="text-xs" style={{ ...sans, color: "var(--muted)" }}>
                  {edit.paper.type === "long-form" ? "Long-form" : `Word · ${edit.paper.words?.word}`}
                  {" · "}
                  {edit.paper.status === "approved" ? "published" : "not yet reviewed"}
                  {" · asked "}
                  {new Date(edit.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex gap-3 items-center shrink-0 flex-wrap">
                <a
                  href={edit.current_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline underline-offset-4"
                  style={link}
                >
                  Current PDF
                </a>
                <a
                  href={edit.replacement_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline underline-offset-4"
                  style={link}
                >
                  Replacement
                </a>
                <button
                  onClick={() => decide(edit.id, "apply")}
                  disabled={acting === edit.id}
                  className="px-4 py-2 text-sm text-white disabled:opacity-50"
                  style={{ ...sans, backgroundColor: "var(--forest)" }}
                >
                  Apply
                </button>
                <button
                  onClick={() => decide(edit.id, "decline")}
                  disabled={acting === edit.id}
                  className="px-4 py-2 text-sm disabled:opacity-50"
                  style={{ ...sans, border: "1px solid var(--border)", color: "var(--muted)" }}
                >
                  Decline
                </button>
              </div>
            </div>
            {edit.note && (
              <p className="text-sm mt-4 whitespace-pre-wrap" style={{ ...sans, color: "var(--ink)" }}>
                {edit.note}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
