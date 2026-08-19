"use client";

import AddWordForm from "./AddWordForm";
import { useAdminData } from "./AdminData";
import { formatDeadline, getDaysRemaining, getMonthName } from "@/lib/word-format";

export default function WordsPanel() {
  const { words, loading } = useAdminData();

  return (
    <div className="space-y-10">
      <AddWordForm />

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
