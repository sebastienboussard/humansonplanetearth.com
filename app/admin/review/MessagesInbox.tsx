"use client";

import { useEffect, useState } from "react";

type Message = {
  id: string;
  body: string;
  reply_email: string | null;
  read: boolean;
  created_at: string;
};

export default function MessagesInbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/messages")
      .then((r) => r.json())
      .then((d) => {
        setMessages(d.messages ?? []);
        setLoading(false);
      });
  }, []);

  async function toggleRead(id: string, read: boolean) {
    setBusy(id);
    await fetch("/api/admin/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read }),
    });
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read } : m)));
    setBusy(null);
  }

  async function remove(id: string) {
    if (!confirm("Permanently delete this message? This cannot be undone.")) return;
    setBusy(id);
    await fetch("/api/admin/messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setBusy(null);
  }

  if (loading) {
    return (
      <p className="text-sm italic" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
        Loading…
      </p>
    );
  }

  if (messages.length === 0) {
    return (
      <div
        className="py-12 text-center rounded-sm"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p className="text-base" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          No messages.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {messages.map((msg) => (
        <li
          key={msg.id}
          className="px-5 py-4 rounded-sm"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              {!msg.read && (
                <span
                  aria-label="Unread"
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: "var(--terracotta)" }}
                />
              )}
              <p className="text-xs" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
                {new Date(msg.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <button
                onClick={() => toggleRead(msg.id, !msg.read)}
                disabled={busy === msg.id}
                className="text-sm disabled:opacity-50"
                style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
              >
                {msg.read ? "Mark unread" : "Mark read"}
              </button>
              <button
                onClick={() => remove(msg.id)}
                disabled={busy === msg.id}
                className="text-sm disabled:opacity-50"
                style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
              >
                Delete
              </button>
            </div>
          </div>
          <p
            className="text-base whitespace-pre-wrap"
            style={{ color: "var(--ink)" }}
          >
            {msg.body}
          </p>
          {msg.reply_email && (
            <p className="text-xs mt-3" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
              Reply to:{" "}
              <a
                href={`mailto:${msg.reply_email}`}
                className="underline underline-offset-4"
                style={{ color: "var(--terracotta)" }}
              >
                {msg.reply_email}
              </a>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
