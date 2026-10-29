"use client";

import { useState } from "react";
import { MAX_UPLOAD_SIZE, oversizeMessage, submitFailureMessage } from "@/lib/upload-limits";

// Change requests (TODO §24): the author sends a replacement PDF, and the admin
// applies it. Only the PDF can change for now. The paper on the site stays as
// it is until then.

export type PaperChange = { status: "pending" | "applied" | "declined"; at: string } | null;

const sansMuted = { fontFamily: "system-ui, sans-serif", color: "var(--muted)" } as const;

// Matches the check in migration 0010 and the route.
const NOTE_MAX = 1000;

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/** One line under a paper saying where its latest change request stands. */
export function changeStatusText(change: PaperChange): string | null {
  if (!change) return null;
  if (change.status === "pending") return "Change requested — waiting for review";
  if (change.status === "applied") return `Change applied ${shortDate(change.at)}`;
  return `Change not applied ${shortDate(change.at)}`;
}

export default function PaperChangeRequest({
  paperId,
  onSent,
}: {
  paperId: string;
  /** Called once the request is in, so the list can show it as waiting. */
  onSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErrorMsg("Choose the new PDF first.");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      setErrorMsg(oversizeMessage(file.size, MAX_UPLOAD_SIZE));
      return;
    }

    setSending(true);
    setErrorMsg("");
    const form = new FormData();
    form.append("paperId", paperId);
    form.append("pdf", file);
    if (note.trim()) form.append("note", note.trim());

    try {
      const res = await fetch("/api/account/papers/edit", { method: "POST", body: form });
      if (res.ok) {
        setOpen(false);
        onSent();
        return;
      }
      setErrorMsg(await submitFailureMessage(res, file.size));
    } catch {
      setErrorMsg("Could not reach the server. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs underline underline-offset-4 mt-2"
        style={{ ...sansMuted, color: "var(--terracotta)" }}
      >
        Request a change
      </button>
    );
  }

  return (
    <form onSubmit={send} className="mt-3 space-y-3">
      <p className="text-xs" style={sansMuted}>
        Send a new PDF to replace this one. It is checked before it goes up, and the
        paper stays as it is until then.
      </p>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block text-xs"
        style={sansMuted}
        aria-label="Replacement PDF"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={NOTE_MAX}
        rows={2}
        placeholder="What changed? (optional)"
        className="w-full text-sm p-2 rounded-sm"
        style={{
          fontFamily: "system-ui, sans-serif",
          border: "1px solid var(--border)",
          backgroundColor: "var(--card)",
          color: "var(--ink)",
        }}
      />
      {errorMsg && (
        <p className="text-xs" role="alert" style={{ ...sansMuted, color: "var(--terracotta)" }}>
          {errorMsg}
        </p>
      )}
      <div className="flex gap-4 items-center">
        <button
          type="submit"
          disabled={sending}
          className="text-sm text-white px-4 py-2 disabled:opacity-40"
          style={{ backgroundColor: "var(--forest)", fontFamily: "system-ui, sans-serif" }}
        >
          {sending ? "Sending…" : "Send request"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setErrorMsg("");
          }}
          className="text-sm underline"
          style={sansMuted}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
