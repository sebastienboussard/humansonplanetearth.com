"use client";

import { useEffect, useState, FormEvent } from "react";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  replies?: Comment[];
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildTree(flat: Comment[]): Comment[] {
  const top = flat.filter((c) => !c.parent_comment_id);
  return top.map((c) => ({
    ...c,
    replies: flat.filter((r) => r.parent_comment_id === c.id),
  }));
}

function CommentForm({
  onSubmit,
  placeholder,
  buttonLabel,
  onCancel,
}: {
  onSubmit: (body: string) => Promise<void>;
  placeholder: string;
  buttonLabel: string;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState("");
  const [trap, setTrap] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (trap) return;
    if (!body.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(body);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handle} className="space-y-3">
      {/* Honeypot */}
      <div style={{ display: "none" }} aria-hidden="true">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={2000}
        className="w-full px-4 py-3 rounded-sm text-sm resize-none"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--ink)",
          fontFamily: "system-ui, sans-serif",
          outline: "none",
        }}
      />

      {error && (
        <p className="text-xs" style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}>
          {error}
        </p>
      )}

      <div className="flex gap-3 items-center">
        <button
          type="submit"
          disabled={!body.trim() || submitting}
          className="px-5 py-2 text-sm text-white disabled:opacity-40"
          style={{ backgroundColor: "var(--forest)", fontFamily: "system-ui, sans-serif" }}
        >
          {submitting ? "Posting…" : buttonLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm"
            style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function Comments({
  wordId,
  paperId,
  title = "Discussion",
  placeholder = "Write a comment…",
}: {
  wordId: string;
  paperId?: string;
  title?: string;
  placeholder?: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ wordId });
    if (paperId) params.set("paperId", paperId);
    fetch(`/api/comments?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setComments(d.comments ?? []);
        setLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });
  }, [wordId, paperId]);

  async function postComment(body: string, parentCommentId?: string) {
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wordId,
        paperId: paperId ?? null,
        parentCommentId: parentCommentId ?? null,
        body,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to post comment.");
    setComments((prev) => [...prev, data.comment]);
    setReplyTo(null);
  }

  const threaded = buildTree(comments);

  return (
    <div className="mt-16">
      <h2 className="text-xl font-normal mb-8" style={{ color: "var(--forest)" }}>
        {title}
      </h2>

      {loading ? (
        <p className="text-sm italic" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          Loading…
        </p>
      ) : fetchError ? (
        <p className="text-sm italic mb-8" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          Couldn't load comments. Please refresh to try again.
        </p>
      ) : threaded.length === 0 ? (
        <p className="text-sm italic mb-8" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          No comments yet. Be the first.
        </p>
      ) : (
        <ul className="space-y-6 mb-10">
          {threaded.map((comment) => (
            <li key={comment.id}>
              {/* Top-level comment */}
              <div
                className="p-4 rounded-sm"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
              >
                <p
                  className="text-sm leading-relaxed mb-2"
                  style={{ color: "var(--ink)", fontFamily: "system-ui, sans-serif", whiteSpace: "pre-wrap" }}
                >
                  {comment.body}
                </p>
                <div className="flex items-center gap-4">
                  <span className="text-xs" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
                    Human On Planet Earth · {timeAgo(comment.created_at)}
                  </span>
                  <button
                    onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                    className="text-xs underline underline-offset-2"
                    style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
                  >
                    {replyTo === comment.id ? "Cancel" : "Reply"}
                  </button>
                </div>
              </div>

              {/* Replies */}
              {(comment.replies?.length ?? 0) > 0 && (
                <ul className="mt-2 ml-6 space-y-2">
                  {comment.replies!.map((reply) => (
                    <li
                      key={reply.id}
                      className="p-4 rounded-sm"
                      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                    >
                      <p
                        className="text-sm leading-relaxed mb-2"
                        style={{ color: "var(--ink)", fontFamily: "system-ui, sans-serif", whiteSpace: "pre-wrap" }}
                      >
                        {reply.body}
                      </p>
                      <span className="text-xs" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
                        Human On Planet Earth · {timeAgo(reply.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Inline reply form */}
              {replyTo === comment.id && (
                <div className="mt-2 ml-6">
                  <CommentForm
                    onSubmit={(body) => postComment(body, comment.id)}
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

      {/* New comment form */}
      <CommentForm
        onSubmit={(body) => postComment(body)}
        placeholder={placeholder}
        buttonLabel="Post"
      />
    </div>
  );
}
