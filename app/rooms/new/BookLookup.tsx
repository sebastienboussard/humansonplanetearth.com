"use client";

import { useState } from "react";
import { coverUrl, type OpenLibraryWork } from "@/lib/open-library";

// Find the book on Open Library (TODO §21b). Picking one hands it to the
// form, which fills in the title, author and year; all of them stay editable,
// since Open Library's data is often close rather than right. Searches run
// on a button or Enter, not on every keystroke, so a person typing doesn't
// spend the 30-a-minute limit.
//
// If Open Library can't be reached, this says so and the form carries on by
// hand: the lookup fails open (app/api/rooms/lookup).

const sans = { fontFamily: "system-ui, sans-serif" } as const;
const field = {
  ...sans,
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  color: "var(--ink)",
  outline: "none",
} as const;

export default function BookLookup({ onPick }: { onPick: (work: OpenLibraryWork) => void }) {
  const [query, setQuery] = useState("");
  const [works, setWorks] = useState<OpenLibraryWork[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState("");

  async function search() {
    const q = query.trim();
    if (q.length < 2 || searching) return;
    setSearching(true);
    setNote("");
    try {
      const res = await fetch(`/api/rooms/lookup?${new URLSearchParams({ q })}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWorks(null);
        setNote(data.error ?? "The search didn't work. You can fill in the details yourself.");
      } else if (data.unavailable) {
        setWorks(null);
        setNote("Open Library isn't answering just now. You can fill in the details yourself.");
      } else {
        setWorks(data.works ?? []);
        if ((data.works ?? []).length === 0) setNote("Nothing found. Try fewer words, or fill in the details yourself.");
      }
    } catch {
      setWorks(null);
      setNote("Network error. You can fill in the details yourself.");
    }
    setSearching(false);
  }

  return (
    <div className="rounded-sm p-4" style={{ border: "1px dashed var(--border)" }}>
      <label htmlFor="book-lookup" className="block text-xs mb-1" style={{ ...sans, color: "var(--muted)" }}>
        Find the book on Open Library to fill this in (optional)
      </label>
      <div className="flex gap-2">
        <input
          id="book-lookup"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter searches instead of submitting the whole room.
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          maxLength={200}
          placeholder="Title or author"
          className="flex-1 min-w-0 px-4 py-2 rounded-sm text-sm"
          style={field}
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={query.trim().length < 2 || searching}
          className="px-4 py-2 text-sm rounded-sm disabled:opacity-40"
          style={{ ...sans, border: "1px solid var(--forest)", color: "var(--forest)" }}
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {note && (
        <p className="text-xs mt-2" style={{ ...sans, color: "var(--muted)" }}>
          {note}
        </p>
      )}

      {works && works.length > 0 && (
        <ul className="mt-3 space-y-1">
          {works.map((work) => (
            <li key={work.key}>
              <button
                type="button"
                onClick={() => {
                  onPick(work);
                  setWorks(null);
                  setNote("");
                }}
                className="w-full flex items-center gap-3 p-2 rounded-sm text-left transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
              >
                {/* Plain lazy <img>: Open Library's cover, not ours to optimise. */}
                {work.coverId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl(work.coverId, "S")} alt="" loading="lazy" width={32} className="shrink-0 rounded-sm" />
                ) : (
                  <span className="shrink-0 rounded-sm" style={{ width: 32, height: 48, backgroundColor: "var(--border)" }} />
                )}
                <span className="min-w-0">
                  <span className="block text-sm truncate" style={{ color: "var(--forest)" }}>{work.title}</span>
                  <span className="block text-xs truncate" style={{ ...sans, color: "var(--muted)" }}>
                    {[work.author, work.year].filter((x) => x !== null).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
