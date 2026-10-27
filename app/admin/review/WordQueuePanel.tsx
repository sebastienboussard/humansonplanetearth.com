"use client";

import { useAdminData } from "./AdminData";

// Words that accounts have proposed, in fair order (TODO §20): everyone's
// first waiting word comes before anyone's second. The admin sees the round
// and the age, never who proposed a word. The API doesn't send it.

const sans = { fontFamily: "system-ui, sans-serif" } as const;

function age(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export default function WordQueuePanel({ onUse }: { onUse: (entry: { id: string; word: string }) => void }) {
  const { queue, loading, declineQueued } = useAdminData();

  return (
    <div
      className="rounded-sm p-6"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-lg font-normal mb-1" style={{ color: "var(--forest)" }}>
        Proposed Words
      </h2>
      <p className="text-xs mb-6" style={{ ...sans, color: "var(--muted)" }}>
        Round 1 is each person&apos;s oldest waiting word, so nobody&apos;s second comes before
        anyone&apos;s first. Using a word fills the form below.
      </p>

      {loading.queue ? (
        <p className="text-sm italic" style={{ ...sans, color: "var(--muted)" }}>
          Loading…
        </p>
      ) : queue.length === 0 ? (
        <p className="text-sm" style={{ ...sans, color: "var(--muted)" }}>
          Nothing waiting.
        </p>
      ) : (
        <ul className="space-y-2">
          {queue.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-4 flex-wrap py-2"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div>
                <span className="text-base" style={{ color: "var(--forest)" }}>
                  {entry.word}
                </span>
                <span className="text-xs ml-3" style={{ ...sans, color: "var(--muted)" }}>
                  round {entry.round} · {age(entry.created_at)}
                </span>
              </div>
              <div className="flex gap-4 text-sm" style={sans}>
                <button
                  type="button"
                  onClick={() => onUse({ id: entry.id, word: entry.word })}
                  style={{ color: "var(--terracotta)" }}
                >
                  Use this word
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Decline "${entry.word}"? The proposer sees it as declined.`)) {
                      void declineQueued(entry.id);
                    }
                  }}
                  style={{ color: "var(--muted)" }}
                >
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
