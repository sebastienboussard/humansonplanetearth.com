"use client";

import { useState } from "react";
import { CommentForm, buildTree, timeAgo } from "@/components/Comments";

// Margins: short replies under a page in a Reading Room (TODO §21). Anyone can
// write one and it shows at once. The form and the one-level reply tree are
// the comment thread's (components/Comments.tsx), so both behave the same.
//
// Folded behind their count until a reader opens them, and fetched only then,
// so a section of many pages reads as pages, not one long thread, and makes
// no margin requests on load. They are drawn as notes on a left rule, not as
// cards, so a margin is never mistaken for the next page.

type Margin = { id: string; body: string; created_at: string; parent_id: string | null };
type Loaded = { state: "loading" } | { state: "failed" } | { state: "done"; margins: Margin[] };

const sans = { fontFamily: "system-ui, sans-serif" } as const;
const note = { borderLeft: "2px solid var(--border)" } as const;

export default function Margins({ pageId, count: initialCount }: { pageId: string; count: number }) {
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  async function load() {
    if (loaded && loaded.state !== "failed") return;
    // Nothing to fetch for a page with no margins yet.
    if (count === 0) {
      setLoaded({ state: "done", margins: [] });
      return;
    }
    setLoaded({ state: "loading" });
    try {
      const res = await fetch(`/api/rooms/margins?page=${encodeURIComponent(pageId)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setLoaded({ state: "done", margins: data.margins ?? [] });
    } catch {
      setLoaded({ state: "failed" });
    }
  }

  function toggle() {
    if (!open) void load();
    setOpen(!open);
  }

  function startWriting() {
    void load();
    setOpen(true);
    setWriting(true);
  }

  async function post(body: string, parentId?: string) {
    const res = await fetch("/api/rooms/margins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, parentId: parentId ?? null, body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Could not save your comment.");
    setLoaded((prev) => ({ state: "done", margins: [...(prev?.state === "done" ? prev.margins : []), data.margin] }));
    setCount((n) => n + 1);
    setReplyTo(null);
    setWriting(false);
  }

  const threaded = loaded?.state === "done" ? buildTree(loaded.margins, (m) => m.parent_id) : [];
  const label = `${count} ${count === 1 ? "comment" : "comments"}`;

  return (
    <div className="mt-5 pt-4 text-xs" style={{ ...sans, borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
      {count > 0 && (
        <button onClick={toggle} aria-expanded={open} className="underline underline-offset-2">
          {open ? "▾" : "▸"} {label}
        </button>
      )}

      {open && loaded && (
        <div className="mt-3">
          {loaded.state === "loading" ? (
            <p className="italic">Loading comments…</p>
          ) : loaded.state === "failed" ? (
            <p className="italic">Couldn&rsquo;t load comments. Close and open again to retry.</p>
          ) : (
            threaded.length > 0 && (
              <ul className="space-y-3">
                {threaded.map((m) => (
                  <li key={m.id} className="pl-3" style={note}>
                    <p className="text-sm leading-relaxed mb-1" style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>
                      {m.body}
                    </p>
                    <span>{timeAgo(m.created_at)}</span>
                    <button
                      onClick={() => setReplyTo(replyTo === m.id ? null : m.id)}
                      className="underline underline-offset-2 ml-3"
                    >
                      {replyTo === m.id ? "Cancel" : "Reply"}
                    </button>
                    {m.replies.length > 0 && (
                      <ul className="mt-2 ml-4 space-y-2">
                        {m.replies.map((r) => (
                          <li key={r.id} className="pl-3" style={note}>
                            <p className="text-sm leading-relaxed mb-1" style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>
                              {r.body}
                            </p>
                            <span>{timeAgo(r.created_at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {replyTo === m.id && (
                      <div className="mt-2 ml-4">
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
            )
          )}
        </div>
      )}

      <div className={count === 0 ? "" : open ? "mt-3" : "hidden"}>
        {writing ? (
          <CommentForm
            onSubmit={(body) => post(body)}
            placeholder="Write a comment…"
            buttonLabel="Add comment"
            onCancel={() => setWriting(false)}
          />
        ) : (
          <button onClick={startWriting} className="underline underline-offset-2" style={{ color: "var(--terracotta)" }}>
            Write a comment
          </button>
        )}
      </div>
    </div>
  );
}
