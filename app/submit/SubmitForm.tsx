"use client";

import { useState, useRef, useEffect } from "react";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type Status = "idle" | "submitting" | "success" | "error";

export default function SubmitForm({ word }: { word: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Honeypot
  const [honeypot, setHoneypot] = useState("");
  // Optional profile attachment (only offered when signed in)
  const [signedIn, setSignedIn] = useState(false);
  const [attach, setAttach] = useState(false);

  useEffect(() => {
    createBrowserSupabase()
      .auth.getUser()
      .then(({ data }) => setSignedIn(Boolean(data?.user)))
      .catch(() => setSignedIn(false));
  }, []);

  function handleFile(f: File) {
    if (f.type !== "application/pdf") {
      setErrorMsg("Only PDF files are accepted.");
      setFile(null);
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setErrorMsg("File must be under 2 MB.");
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
    if (honeypot) return; // bot
    if (!file) return;

    setStatus("submitting");
    setErrorMsg("");

    const body = new FormData();
    body.append("pdf", file);
    body.append("word", word);
    body.append("_trap", honeypot);
    if (signedIn && attach) body.append("attach", "1");

    try {
      const res = await fetch("/api/submit", { method: "POST", body });
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

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
                1 page max · 2 MB max
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Optional profile attachment — only rendered for signed-in visitors */}
      {signedIn && (
        <label
          className="flex items-start gap-3 cursor-pointer text-sm"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--ink)" }}
        >
          <input
            type="checkbox"
            checked={attach}
            onChange={(e) => setAttach(e.target.checked)}
            className="mt-1"
          />
          <span>
            Attach to my anonymous profile
            <span className="block text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Kept private unless you choose to share it. The paper is still published
              anonymously either way.
            </span>
          </span>
        </label>
      )}

      {/* Honeypot — hidden from real users */}
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
        disabled={!file || status === "submitting"}
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
