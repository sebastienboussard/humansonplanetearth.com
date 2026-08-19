"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type Prefs = {
  new_word: boolean;
  deadline_reminders: boolean;
  deadline_14d: boolean;
  deadline_7d: boolean;
  deadline_1d: boolean;
  paper_comments: boolean;
  comment_replies: boolean;
};

type PaperEntry = {
  paper_id: string;
  papers: {
    id: string;
    title: string | null;
    type: string;
    status: string;
    submitted_at: string;
  } | null;
};

const PREF_LABELS: { key: keyof Prefs; label: string; detail: string }[] = [
  { key: "new_word", label: "New word announced", detail: "When a new monthly word is published." },
  { key: "deadline_reminders", label: "Deadline reminders", detail: "Before the current word's deadline — pick which ones below." },
  { key: "paper_comments", label: "Comments on your papers", detail: "When someone comments on a paper attached to your profile." },
  { key: "comment_replies", label: "Replies to your comments", detail: "When someone replies to a comment you made while signed in." },
];

// Shown indented under "Deadline reminders" while that switch is on. Two weeks
// is off by default; the other two match what the reminder always sent.
const DEADLINE_WINDOWS: { key: keyof Prefs; label: string }[] = [
  { key: "deadline_14d", label: "2 weeks before" },
  { key: "deadline_7d", label: "1 week before" },
  { key: "deadline_1d", label: "1 day before" },
];

const sansMuted = { fontFamily: "system-ui, sans-serif", color: "var(--muted)" } as const;
const sansInk = { fontFamily: "system-ui, sans-serif", color: "var(--ink)" } as const;

// The notifications panel is seven checkboxes deep and pushed everything else
// below the fold, so it collapses. Closed by default — the papers list is what
// people come back for; prefs are set once. Read from localStorage in an effect
// rather than in the initial state so the server and first client render agree.
const NOTIF_OPEN_KEY = "hope-account-notifications-open";

export default function AccountDashboard() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [papers, setPapers] = useState<PaperEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    try {
      setNotifOpen(localStorage.getItem(NOTIF_OPEN_KEY) === "true");
    } catch {
      // Storage blocked (private mode, hardened browser) — stay closed.
    }
  }, []);

  function toggleNotifOpen() {
    setNotifOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem(NOTIF_OPEN_KEY, String(next));
      } catch {
        // Preference just won't persist; the panel still opens.
      }
      return next;
    });
  }

  useEffect(() => {
    async function load() {
      try {
        const [meRes, papersRes] = await Promise.all([
          fetch("/api/account/me"),
          fetch("/api/account/papers"),
        ]);
        const me = await meRes.json();
        const mine = await papersRes.json();
        if (!meRes.ok) throw new Error(me.error);
        setPrefs(me.prefs);
        setPapers(papersRes.ok ? mine.papers ?? [] : []);
      } catch {
        setErrorMsg("Could not load your account. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function togglePref(key: keyof Prefs) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimistic
    const res = await fetch("/api/account/prefs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
    });
    if (!res.ok) setPrefs(prefs); // revert
  }

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    window.location.href = "/account";
  }

  async function deleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      window.location.href = "/";
    } else {
      setDeleting(false);
      setErrorMsg("Deletion failed. Please try again.");
    }
  }

  if (loading) {
    return <p className="text-sm" style={sansMuted}>Loading…</p>;
  }

  if (errorMsg && !prefs) {
    return <p className="text-sm" style={{ ...sansMuted, color: "var(--terracotta)" }}>{errorMsg}</p>;
  }

  // Only the four master switches count; the deadline windows live under one of
  // them and would make "6 of 7 on" read as more than the reader turned on.
  const enabledCount = PREF_LABELS.filter(({ key }) => prefs?.[key]).length;

  return (
    <div className="space-y-12">
      {/* Notification preferences */}
      <section>
        <h2 className="text-xl mb-4" style={{ color: "var(--forest)" }}>
          <button
            type="button"
            onClick={toggleNotifOpen}
            aria-expanded={notifOpen}
            aria-controls="notification-prefs"
            className="flex items-baseline gap-3 w-full text-left"
          >
            <span>Email Notifications</span>
            <span className="text-xs" style={sansMuted}>
              {enabledCount === 0
                ? "all off"
                : `${enabledCount} of ${PREF_LABELS.length} on`}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              aria-hidden="true"
              className="ml-auto shrink-0 self-center"
              style={{
                color: "var(--muted)",
                transition: "transform 150ms",
                transform: notifOpen ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              <path
                d="M4 2l4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </h2>
        <div
          id="notification-prefs"
          hidden={!notifOpen}
          className="rounded-sm divide-y"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          {PREF_LABELS.map(({ key, label, detail }) => {
            const expandable = key === "deadline_reminders";
            const expanded = expandable && (prefs?.deadline_reminders ?? false);
            return (
              // The expandable row can't be one <label>: nesting the window
              // checkboxes inside it would make clicking them toggle the parent.
              <div key={key} style={{ borderColor: "var(--border)" }}>
                <label className="flex items-start gap-3 p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs?.[key] ?? false}
                    onChange={() => togglePref(key)}
                    className="mt-1"
                    aria-expanded={expandable ? expanded : undefined}
                  />
                  <span>
                    <span className="block text-sm" style={sansInk}>{label}</span>
                    <span className="block text-xs mt-0.5" style={sansMuted}>{detail}</span>
                  </span>
                </label>

                {expanded && (
                  <div className="pb-4 pl-12 pr-4 space-y-2" role="group" aria-label="Deadline reminder timing">
                    {DEADLINE_WINDOWS.map((window) => (
                      <label key={window.key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefs?.[window.key] ?? false}
                          onChange={() => togglePref(window.key)}
                        />
                        <span className="text-sm" style={sansInk}>{window.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* My papers */}
      <section>
        <h2 className="text-xl mb-1" style={{ color: "var(--forest)" }}>
          Your Papers
        </h2>
        <p className="text-xs mb-4" style={sansMuted}>
          Papers attached to your profile. This list is private — it is only
          visible to you, here.
        </p>
        {papers.length === 0 ? (
          <p className="text-sm italic" style={{ color: "var(--muted)" }}>
            No papers attached yet. Sign in before submitting and check “attach to my
            profile” to link one.
          </p>
        ) : (
          <div
            className="rounded-sm divide-y"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            {papers.map((entry) => (
              <div key={entry.paper_id} className="p-4">
                <p className="text-sm" style={sansInk}>
                  {entry.papers?.title || "Word paper"}
                </p>
                <p className="text-xs mt-0.5" style={sansMuted}>
                  {entry.papers?.status ?? "unknown"} ·{" "}
                  {entry.papers?.submitted_at
                    ? new Date(entry.papers.submitted_at).toLocaleDateString()
                    : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Session + danger zone */}
      <section
        className="pt-8 space-y-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {errorMsg && (
          <p className="text-sm" style={{ ...sansMuted, color: "var(--terracotta)" }}>{errorMsg}</p>
        )}
        <button
          onClick={signOut}
          className="text-sm underline"
          style={sansMuted}
        >
          Sign out
        </button>
        <div>
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm" style={sansInk}>
                Delete your account? Your email and all profile links are removed
                permanently. Your papers stay published anonymously.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={deleteAccount}
                  disabled={deleting}
                  className="text-sm text-white px-4 py-2 disabled:opacity-40"
                  style={{ backgroundColor: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
                >
                  {deleting ? "Deleting…" : "Yes, delete everything"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm underline"
                  style={sansMuted}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm underline"
              style={{ fontFamily: "system-ui, sans-serif", color: "var(--terracotta)" }}
            >
              Delete account
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
