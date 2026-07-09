"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const MAX_LEN = 5000;

export default function ContactForm() {
  const [body, setBody] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [honeypot, setHoneypot] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return;
    if (!body.trim()) return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          reply_email: replyEmail.trim() || null,
          _trap: honeypot,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        className="py-12 text-center rounded-sm"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p className="text-lg mb-2" style={{ color: "var(--forest)" }}>
          Message received.
        </p>
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          Thank you for reaching out.
        </p>
      </div>
    );
  }

  const inputStyle = {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--ink)",
    fontFamily: "system-ui, sans-serif",
    fontSize: "0.875rem",
    outline: "none",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="body"
          className="block text-sm mb-2"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--ink)" }}
        >
          Message
        </label>
        <textarea
          id="body"
          required
          rows={8}
          maxLength={MAX_LEN}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message here."
          className="w-full px-4 py-3 rounded-sm resize-y"
          style={inputStyle}
        />
        <p
          className="text-xs mt-1"
          style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
        >
          {body.length} / {MAX_LEN}
        </p>
      </div>

      <div>
        <label
          htmlFor="reply_email"
          className="block text-sm mb-2"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--ink)" }}
        >
          Reply email (optional)
        </label>
        <input
          id="reply_email"
          type="email"
          value={replyEmail}
          onChange={(e) => setReplyEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-sm"
          style={inputStyle}
        />
        <p
          className="text-xs mt-1"
          style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
        >
          Only if you&apos;d like a response.
        </p>
      </div>

      {/* Honeypot */}
      <div style={{ display: "none" }} aria-hidden="true">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {errorMsg && (
        <p className="text-sm" style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}>
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={!body.trim() || status === "submitting"}
        className="w-full py-3 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--terracotta)",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "0.05em",
        }}
      >
        {status === "submitting" ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
