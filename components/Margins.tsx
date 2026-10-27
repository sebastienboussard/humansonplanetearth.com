"use client";

import { useEffect, useState } from "react";
import { CommentForm, buildTree, timeAgo } from "@/components/Comments";

// Margins: short replies under a page in a Reading Room (TODO §21). Anyone can
// write one and it shows at once. The form and the one-level reply tree are
// the comment thread's (components/Comments.tsx), so both behave the same.

type Margin = { id: string; body: string; created_at: string; parent_id: string | null };

const sans = { fontFamily: "system-ui, sans-serif" } as const;
const card = { backgroundColor: "var(--card)", border: "1px solid var(--border)" } as const;

export default function Margins({ pageId }: { pageId: string }) {
  const [margins, setMargins] = useState<Margin[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/rooms/margins?page=${encodeURIComponent(pageId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!ignore) setMargins(d.margins ?? []);
      })
      .catch(() => {
        if (!ignore) setFailed(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [pageId]);

  async function post(body: string, parentId?: string) {
    const res = await fetch("/api/rooms/margins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, parentId: parentId ?? null, body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Could not save your margin.");
    setMargins((prev) => [...prev, data.margin]);
    setReplyTo(null);
    setWriting(false);
  }

  const threaded = buildTree(margins, (m) => m.parent_id);

  return (
    <div className="mt-4 ml-4 pl-4" style={{ borderLeft: "2px solid var(--border)" }}>
      {loading ? (
        <p className="text-xs italic" style={{ ...sans, color: "var(--muted)" }}>Loading margins…</p>
      ) : failed ? (
        <p className="text-xs italic" style={{ ...sans, color: "var(--muted)" }}>Couldn&rsquo;t load margins.</p>
      ) : (
        <ul className="space-y-3">
          {threaded.map((m) => (
            <li key={m.id}>
              <div className="p-3 rounded-sm" style={card}>
                <p className="text-sm leading-relaxed mb-1" style={{ ...sans, color: "var(--ink)", whiteSpace: "pre-wrap" }}>
                  {m.body}
                </p>
                <span className="text-xs" style={{ ...sans, color: "var(--muted)" }}>
                  Human On Planet Earth · {timeAgo(m.created_at)}
                </span>{" "}
                <button
                  onClick={() => setReplyTo(replyTo === m.id ? null : m.id)}
                  className="text-xs underline underline-offset-2 ml-3"
                  style={{ ...sans, color: "var(--muted)" }}
                >
                  {replyTo === m.id ? "Cancel" : "Reply"}
                </button>
              </div>
              {m.replies.length > 0 && (
                <ul className="mt-2 ml-5 space-y-2">
                  {m.replies.map((r) => (
                    <li key={r.id} className="p-3 rounded-sm" style={card}>
                      <p className="text-sm leading-relaxed mb-1" style={{ ...sans, color: "var(--ink)", whiteSpace: "pre-wrap" }}>
                        {r.body}
                      </p>
                      <span className="text-xs" style={{ ...sans, color: "var(--muted)" }}>
                        Human On Planet Earth · {timeAgo(r.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {replyTo === m.id && (
                <div className="mt-2 ml-5">
                  <CommentForm
                    onSubmit={(body) => post(body, m.id)}
                    placeholder="Write a reply…"
                    buttonLabel="Reply"
                    onCancel={() => setReplyTo(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Collapsed by default, so a page with no margins stays quiet. */}
      <div className="mt-3">
        {writing ? (
          <CommentForm
            onSubmit={(body) => post(body)}
            placeholder="Write in the margin…"
            buttonLabel="Add margin"
            onCancel={() => setWriting(false)}
          />
        ) : (
          <button
            onClick={() => setWriting(true)}
            className="text-xs underline underline-offset-2"
            style={{ ...sans, color: "var(--terracotta)" }}
          >
            Write in the margin
          </button>
        )}
      </div>
    </div>
  );
}
