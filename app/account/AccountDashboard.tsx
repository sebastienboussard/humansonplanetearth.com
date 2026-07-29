"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type Prefs = {
  new_word: boolean;
  deadline_reminders: boolean;
  paper_comments: boolean;
  comment_replies: boolean;
};

type PaperEntry = {
  paper_id: string;
  public_visible: boolean;
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
  { key: "deadline_reminders", label: "Deadline reminders", detail: "7 days and 1 day before the current word's deadline." },
  { key: "paper_comments", label: "Comments on your papers", detail: "When someone comments on a paper attached to your profile." },
  { key: "comment_replies", label: "Replies to your comments", detail: "When someone replies to a comment you made while signed in." },
];

const sansMuted = { fontFamily: "system-ui, sans-serif", color: "var(--muted)" } as const;
const sansInk = { fontFamily: "system-ui, sans-serif", color: "var(--ink)" } as const;

export default function AccountDashboard() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [papers, setPapers] = useState<PaperEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        setProfileId(me.profile.id);
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

  async function togglePaper(paperId: string, visible: boolean) {
    setPapers((ps) =>
      ps.map((p) => (p.paper_id === paperId ? { ...p, public_visible: visible } : p))
    );
    const res = await fetch("/api/account/papers", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paperId, publicVisible: visible }),
    });
    if (!res.ok) {
      setPapers((ps) =>
        ps.map((p) => (p.paper_id === paperId ? { ...p, public_visible: !visible } : p))
      );
    }
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

  return (
    <div className="space-y-12">
      {/* Notification preferences */}
      <section>
        <h2 className="text-xl mb-4" style={{ color: "var(--forest)" }}>
          Email Notifications
        </h2>
        <div
          className="rounded-sm divide-y"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          {PREF_LABELS.map(({ key, label, detail }) => (
            <label
              key={key}
              className="flex items-start gap-3 p-4 cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              <input
                type="checkbox"
                checked={prefs?.[key] ?? false}
                onChange={() => togglePref(key)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm" style={sansInk}>{label}</span>
                <span className="block text-xs mt-0.5" style={sansMuted}>{detail}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* My papers */}
      <section>
        <h2 className="text-xl mb-1" style={{ color: "var(--forest)" }}>
          Your Papers
        </h2>
        <p className="text-xs mb-4" style={sansMuted}>
          Papers attached to your profile. They are private by default — turning one on
          lists it on your{" "}
          {profileId ? (
            <Link href={`/author/${profileId}`} className="underline">
              anonymous author page
            </Link>
          ) : (
            "anonymous author page"
          )}
          , still with no name.
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
              <div key={entry.paper_id} className="flex items-center justify-between gap-3 p-4">
                <div>
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
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={sansMuted}>
                  <input
                    type="checkbox"
                    checked={entry.public_visible}
                    onChange={(e) => togglePaper(entry.paper_id, e.target.checked)}
                  />
                  Show on author page
                </label>
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
