"use client";

import { useState } from "react";
import AddWordForm from "./AddWordForm";
import WordQueuePanel from "./WordQueuePanel";
import { useAdminData } from "./AdminData";
import { formatDeadline, getDaysRemaining, getMonthName } from "@/lib/word-format";

export default function WordsPanel() {
  const { words, loading } = useAdminData();
  // The proposal picked in the queue, if any. Keying the form on it remounts
  // the form with that word filled in (TODO §20).
  const [fromQueue, setFromQueue] = useState<{ id: string; word: string } | null>(null);

  return (
    <div className="space-y-10">
      <WordQueuePanel onUse={setFromQueue} />

      <AddWordForm
        key={fromQueue?.id ?? "by-hand"}
        fromQueue={fromQueue ?? undefined}
        onCancelQueue={() => setFromQueue(null)}
      />

      {loading.words ? (
        <p className="text-sm italic" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          Loading…
        </p>
      ) : words.length === 0 ? (
        <div
          className="py-12 text-center rounded-sm"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-base" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
            No words yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {words.map((entry) => {
            const daysLeft = getDaysRemaining(entry.deadline);
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 px-5 py-4 rounded-sm flex-wrap"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div>
                  <p className="text-base font-normal" style={{ color: "var(--forest)" }}>
                    {entry.word}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
                  >
                    {getMonthName(entry.month)} {entry.year} · deadline{" "}
                    {formatDeadline(entry.deadline)}
                  </p>
                </div>
                {daysLeft > 0 && (
                  <p
                    className="text-xs shrink-0"
                    style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
                  >
                    {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
