"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LIMITS, MEDIUMS, WHOLE_WORK_LABEL, buildSections, parseLinks, sectionsProblem } from "@/lib/rooms";

// The room's breakdown is typed one part per line. Any shape is the same data,
// whether chapters, acts or timestamps, and "The whole work" is always added
// at the end (lib/rooms.ts buildSections).
//
// With an account the form opens the room. Without one it sends the same room
// as a request, which waits for the admin (app/api/rooms/requests).

const sans = { fontFamily: "system-ui, sans-serif" } as const;
const field = {
  ...sans,
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  color: "var(--ink)",
  outline: "none",
} as const;
const label = "block text-xs mb-1";

export default function NewRoomForm({ mode = "open" }: { mode?: "open" | "request" }) {
  const router = useRouter();
  const requesting = mode === "request";
  const [replyEmail, setReplyEmail] = useState("");
  const [requested, setRequested] = useState(false);
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [medium, setMedium] = useState<(typeof MEDIUMS)[number]>("book");
  const [year, setYear] = useState("");
  const [intro, setIntro] = useState("");
  const [lines, setLines] = useState("");
  const [linkLines, setLinkLines] = useState("");
  const [chapterCount, setChapterCount] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const sections = buildSections(lines.split("\n"));
  const parsedLinks = parseLinks(linkLines);
  const linkProblem = "error" in parsedLinks ? parsedLinks.error : null;
  const problem = sectionsProblem(sections);

  function fillChapters() {
    const n = Math.min(LIMITS.sections, Math.max(0, Math.floor(Number(chapterCount))));
    if (n > 0) setLines(Array.from({ length: n }, (_, i) => `Chapter ${i + 1}`).join("\n"));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot || !title.trim() || problem || linkProblem || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(requesting ? "/api/rooms/requests" : "/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          creator,
          medium,
          year: year.trim() || null,
          intro,
          sections: lines.split("\n"),
          links: linkLines.split("\n"),
          ...(requesting ? { reply_email: replyEmail } : {}),
          _trap: honeypot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && requesting) {
        setRequested(true);
        return;
      }
      if (res.ok && data.slug) {
        router.push(`/rooms/${data.slug}`);
        return;
      }
      setError(data.error ?? (requesting ? "Could not send your request. Please try again." : "Could not open the room. Please try again."));
    } catch {
      setError("Network error. Please try again.");
    }
    setSending(false);
  }

  if (requested) {
    return (
      <p className="text-sm" style={{ ...sans, color: "var(--ink)" }}>
        Thank you. Your request has gone to the admin, and the room will appear on the{" "}
        <Link href="/rooms" className="underline underline-offset-4" style={{ color: "var(--terracotta)" }}>Reading Rooms</Link>{" "}
        page if it is opened.{replyEmail.trim() ? " You'll get one email either way." : ""}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label htmlFor="room-title" className={label} style={{ ...sans, color: "var(--muted)" }}>Title of the work</label>
        <input id="room-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} className="w-full px-4 py-3 rounded-sm text-sm" style={field} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="room-creator" className={label} style={{ ...sans, color: "var(--muted)" }}>By (author, director…)</label>
          <input id="room-creator" value={creator} onChange={(e) => setCreator(e.target.value)} maxLength={LIMITS.creator} className="w-full px-4 py-3 rounded-sm text-sm" style={field} />
        </div>
        <div>
          <label htmlFor="room-year" className={label} style={{ ...sans, color: "var(--muted)" }}>Year</label>
          <input id="room-year" value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" maxLength={5} className="w-full px-4 py-3 rounded-sm text-sm" style={field} />
        </div>
      </div>
      <div>
        <span className={label} style={{ ...sans, color: "var(--muted)" }}>It&apos;s a…</span>
        <div className="flex flex-wrap gap-4 text-sm" style={sans}>
          {MEDIUMS.map((m) => (
            <label key={m} className="flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
              <input type="radio" name="medium" value={m} checked={medium === m} onChange={() => setMedium(m)} />
              {m}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="room-intro" className={label} style={{ ...sans, color: "var(--muted)" }}>A few words to open the room (optional)</label>
        <textarea id="room-intro" value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={LIMITS.intro} rows={3} className="w-full px-4 py-3 rounded-sm text-sm" style={field} />
      </div>

      <div>
        <label htmlFor="room-sections" className={label} style={{ ...sans, color: "var(--muted)" }}>
          The parts, one per line: chapters, acts, timestamps, anything. Leave it empty to write about the whole work only.
        </label>
        <div className="flex gap-2 items-center mb-2 text-xs" style={sans}>
          <span style={{ color: "var(--muted)" }}>Or fill in chapters 1 to</span>
          <input value={chapterCount} onChange={(e) => setChapterCount(e.target.value)} inputMode="numeric" maxLength={2} aria-label="Number of chapters" className="w-14 px-2 py-1 rounded-sm" style={field} />
          <button type="button" onClick={fillChapters} className="underline" style={{ color: "var(--terracotta)" }}>Fill</button>
        </div>
        <textarea id="room-sections" value={lines} onChange={(e) => setLines(e.target.value)} rows={8} placeholder={"Book One: Miss Brooke\nBook Two: Old and Young\n0:00–32:00 The farm"} className="w-full px-4 py-3 rounded-sm text-sm" style={field} />
        <p className="text-xs mt-1" style={{ ...sans, color: problem ? "var(--terracotta)" : "var(--muted)" }}>
          {problem ?? `${sections.length - 1} ${sections.length - 1 === 1 ? "part" : "parts"}, then "${WHOLE_WORK_LABEL}".`}
        </p>
      </div>

      <div>
        <label htmlFor="room-links" className={label} style={{ ...sans, color: "var(--muted)" }}>
          Where to find it (optional): links to read, borrow, buy or watch it, one per line, up to {LIMITS.links}.
        </label>
        <textarea id="room-links" value={linkLines} onChange={(e) => setLinkLines(e.target.value)} rows={3} placeholder={"https://www.gutenberg.org/ebooks/145\nhttps://openlibrary.org/works/OL1097698W"} className="w-full px-4 py-3 rounded-sm text-sm" style={field} />
        {linkProblem && <p className="text-xs mt-1" style={{ ...sans, color: "var(--terracotta)" }}>{linkProblem}</p>}
      </div>

      {requesting && (
        <div>
          <label htmlFor="room-reply-email" className={label} style={{ ...sans, color: "var(--muted)" }}>
            Your email, to hear whether it opens (optional). Used once, then deleted.
          </label>
          <input id="room-reply-email" type="email" value={replyEmail} onChange={(e) => setReplyEmail(e.target.value)} maxLength={320} className="w-full px-4 py-3 rounded-sm text-sm" style={field} />
        </div>
      )}

      {/* Honeypot — hidden from real users */}
      <div style={{ display: "none" }} aria-hidden="true">
        <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      {error && <p className="text-sm" style={{ ...sans, color: "var(--terracotta)" }}>{error}</p>}

      <button
        type="submit"
        disabled={!title.trim() || !!problem || !!linkProblem || sending}
        className="w-full py-3 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ ...sans, backgroundColor: "var(--terracotta)", letterSpacing: "0.05em" }}
      >
        {requesting ? (sending ? "Sending…" : "Ask for this Room") : sending ? "Opening…" : "Open the Room"}
      </button>
    </form>
  );
}
