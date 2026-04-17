"use client";

import { useState, useRef } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export default function LongFormSubmitForm() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  function handleFile(f: File) {
    if (f.type !== "application/pdf") {
      setErrorMsg("Only PDF files are accepted.");
      setFile(null);
      return;
    }
    if (f.size > MAX_SIZE) {
      setErrorMsg("File must be under 10 MB.");
      setFile(null);
      return;
    }
    setErrorMsg("");
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return;
    if (!file || !title.trim() || !email) return;

    setStatus("submitting");
    setErrorMsg("");

    const body = new FormData();
    body.append("pdf", file);
    body.append("title", title.trim());
    body.append("email", email);
    body.append("_trap", honeypot);

    try {
      const res = await fetch("/api/submit/long-form", { method: "POST", body });
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
          Paper received.
        </p>
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          It will be reviewed and published anonymously as <em>Human On Planet Earth</em>.
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

      {/* Title */}
      <div>
        <label
          htmlFor="title"
          className="block text-sm mb-2"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--ink)" }}
        >
          Title
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="The title of your paper"
          className="w-full px-4 py-3 rounded-sm"
          style={inputStyle}
        />
      </div>

      {/* PDF drop zone */}
      <div>
        <label
          className="block text-sm mb-2"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--ink)" }}
        >
          Your paper (PDF)
        </label>
        <div
          className="rounded-sm p-8 text-center cursor-pointer transition-colors"
          style={{
            border: `2px dashed ${dragOver ? "var(--terracotta)" : "var(--border)"}`,
            backgroundColor: dragOver ? "var(--parchment-dark)" : "var(--card)",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {file ? (
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--forest)", fontFamily: "system-ui, sans-serif" }}>
                {file.name}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
                {(file.size / 1024).toFixed(0)} KB · Click to change
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
                Drag and drop your PDF here, or click to browse
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
                No page limit · 10 MB max
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm mb-2"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--ink)" }}
        >
          Your email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-sm"
          style={inputStyle}
        />
        <p className="text-xs mt-1" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          Never displayed. Used only to prevent duplicate submissions.
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
        disabled={!file || !title.trim() || !email || status === "submitting"}
        className="w-full py-3 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--terracotta)",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "0.05em",
        }}
      >
        {status === "submitting" ? "Submitting…" : "Submit Paper"}
      </button>
    </form>
  );
}
