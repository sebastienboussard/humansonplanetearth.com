"use client";

import { useEffect, useState } from "react";
import { isValidWord, normalizeWord } from "@/lib/word-format";

// Propose words for a future month (TODO §20). The proposer sees status only:
// waiting, used or declined, never a round or a position. Seb's call,
// 2026-09-15.
//
// Loads on its own, not inside the dashboard's Promise.all, so a failure here
// can never blank the rest of the account page.

type Proposal = { id: string; word: string; status: "waiting" | "used" | "declined"; created_at: string };

const sans = { fontFamily: "system-ui, sans-serif" } as const;
const STATUS_LABEL: Record<Proposal["status"], string> = {
  waiting: "Waiting",
  used: "Used as a word of the month",
  declined: "Not used",
};

export default function YourWords() {
  const [words, setWords] = useState<Proposal[]>([]);
  const [maxWaiting, setMaxWaiting] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/account/words", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setWords(data.words ?? []);
        setMaxWaiting(data.maxWaiting ?? 3);
      } catch {
        setLoadError(true);
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

  const waiting = words.filter((w) => w.status === "waiting").length;
  const full = waiting >= maxWaiting;

  async function propose(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidWord(draft) || saving || full) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/account/words", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ word: normalizeWord(draft) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.word) {
        setWords((prev) => [data.word, ...prev]);
        setDraft("");
      } else {
        setError(data.error ?? "Could not save your word. Please try again.");
      }
    } catch {
      setError("Could not save your word. Please try again.");
    }
    setSaving(false);
  }

  async function withdraw(id: string) {
    const res = await fetch(`/api/account/words?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setWords((prev) => prev.filter((w) => w.id !== id));
    else setError("Could not withdraw that word. Please refresh and try again.");
  }

  return (
    <section>
      <h2 className="text-xl mb-1" style={{ color: "var(--forest)" }}>
        Your Words
      </h2>
      <p className="text-sm mb-6" style={{ ...sans, color: "var(--muted)" }}>
        Suggest a word for a future month. Everyone&apos;s first waiting word is considered before
        anyone&apos;s second, and an editor decides which are used and when. You can have{" "}
        {maxWaiting} waiting at a time.
      </p>

      {!loaded ? (
        <p className="text-sm italic" style={{ ...sans, color: "var(--muted)" }}>
          Loading…
        </p>
      ) : loadError ? (
        <p className="text-sm" style={{ ...sans, color: "var(--terracotta)" }}>
          Could not load your words. Please refresh.
        </p>
      ) : (
        <>
          <form onSubmit={propose} className="flex gap-3 mb-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={full ? `${maxWaiting} of ${maxWaiting} waiting` : "a word"}
              disabled={full}
              maxLength={24}
              aria-label="Propose a word"
              className="flex-1 px-4 py-2 rounded-sm text-sm disabled:opacity-50"
              style={{ ...sans, backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--ink)", outline: "none" }}
            />
            <button
              type="submit"
              disabled={!isValidWord(draft) || saving || full}
              className="px-5 py-2 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ ...sans, backgroundColor: "var(--forest)" }}
            >
              {saving ? "Saving…" : "Propose"}
            </button>
          </form>
          <p className="text-xs mb-6" style={{ ...sans, color: "var(--muted)" }}>
            {waiting} of {maxWaiting} waiting
          </p>

          {error && (
            <p className="text-sm mb-4" style={{ ...sans, color: "var(--terracotta)" }}>
              {error}
            </p>
          )}

          {words.length > 0 && (
            <ul className="space-y-2">
              {words.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 rounded-sm"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <span style={{ color: "var(--ink)" }}>{w.word}</span>
                  <span className="text-xs flex items-center gap-4" style={{ ...sans, color: "var(--muted)" }}>
                    {STATUS_LABEL[w.status]}
                    {w.status === "waiting" && (
                      <button type="button" onClick={() => withdraw(w.id)} className="underline">
                        Withdraw
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
