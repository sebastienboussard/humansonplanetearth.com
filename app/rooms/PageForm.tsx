"use client";

import { useState } from "react";
import { LIMITS } from "@/lib/rooms";

// Write a page about one section (TODO §21). No account needed, Seb's call.
// The page waits for review, then appears as Human On Planet Earth.

const sans = { fontFamily: "system-ui, sans-serif" } as const;
const field = {
  ...sans,
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  color: "var(--ink)",
  outline: "none",
} as const;

export default function PageForm({ sectionId, sectionLabel }: { sectionId: string; sectionLabel: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [quote, setQuote] = useState("");
  const [locator, setLocator] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot || !title.trim() || !body.trim()) return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/rooms/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sectionId, title, body, quote, locator, _trap: honeypot }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("sent");
      } else {
        setError(data.error ?? "Could not send your page. Please try again.");
        setStatus("idle");
      }
    } catch {
      setError("Network error. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="py-10 text-center rounded-sm" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="text-lg mb-1" style={{ color: "var(--forest)" }}>Thank you.</p>
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          Your page will appear here once it has been read, as Human On Planet Earth.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-sm p-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <h2 className="text-xl font-normal" style={{ color: "var(--forest)" }}>Write about {sectionLabel}</h2>
      <p className="text-xs" style={{ ...sans, color: "var(--muted)" }}>
        No account needed. Pages are read before they appear, and are always published as Human On Planet Earth.
      </p>

      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.pageTitle} placeholder="A title" aria-label="Title" className="w-full px-4 py-3 rounded-sm text-sm" style={field} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={LIMITS.pageBody} rows={10} placeholder="Your page" aria-label="Your page" className="w-full px-4 py-3 rounded-sm text-sm" style={field} />
      <p className="text-xs -mt-2 text-right" style={{ ...sans, color: "var(--muted)" }}>{body.length} / {LIMITS.pageBody}</p>

      <details>
        <summary className="text-sm cursor-pointer" style={{ ...sans, color: "var(--muted)" }}>Answering a particular passage? (optional)</summary>
        <div className="space-y-3 mt-3">
          <textarea value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={LIMITS.quote} rows={3} placeholder={`The passage, up to ${LIMITS.quote} characters`} aria-label="Quoted passage" className="w-full px-4 py-3 rounded-sm text-sm" style={field} />
          <input value={locator} onChange={(e) => setLocator(e.target.value)} maxLength={LIMITS.locator} placeholder="Where it is: p. 112, or 1:04:30" aria-label="Page or time" className="w-full px-4 py-3 rounded-sm text-sm" style={field} />
        </div>
      </details>

      {/* Honeypot — hidden from real users */}
      <div style={{ display: "none" }} aria-hidden="true">
        <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      {error && <p className="text-sm" style={{ ...sans, color: "var(--terracotta)" }}>{error}</p>}

      <button
        type="submit"
        disabled={!title.trim() || !body.trim() || status === "sending"}
        className="w-full py-3 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ ...sans, backgroundColor: "var(--terracotta)", letterSpacing: "0.05em" }}
      >
        {status === "sending" ? "Sending…" : "Send Page"}
      </button>
    </form>
  );
}
