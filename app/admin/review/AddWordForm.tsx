"use client";

import { useState } from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // day 0 = last day of previous month
  return d.toISOString().split("T")[0];
}

export default function AddWordForm() {
  const now = new Date();
  const [word, setWord] = useState("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [deadline, setDeadline] = useState(lastDayOfMonth(now.getFullYear(), now.getMonth() + 1));
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  function handleMonthOrYearChange(newMonth: string, newYear: string) {
    const m = parseInt(newMonth, 10);
    const y = parseInt(newYear, 10);
    if (m >= 1 && m <= 12 && y >= 2020) {
      setDeadline(lastDayOfMonth(y, m));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const res = await fetch("/api/admin/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, month, year, deadline }),
    });

    if (res.ok) {
      setStatus("success");
      setWord("");
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setStatus("error");
    }
  }

  const inputStyle = {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    fontFamily: "system-ui, sans-serif",
    color: "var(--ink)",
    outline: "none",
  };

  return (
    <div
      className="rounded-sm p-6"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-lg font-normal mb-6" style={{ color: "var(--forest)" }}>
        Add a Word
      </h2>

      {status === "success" && (
        <p
          className="text-sm mb-4"
          style={{ color: "var(--forest)", fontFamily: "system-ui, sans-serif" }}
        >
          Word added successfully.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            className="block text-xs mb-1"
            style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
          >
            Word
          </label>
          <input
            type="text"
            required
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="e.g. solitude"
            className="w-full px-4 py-2 text-sm rounded-sm"
            style={inputStyle}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label
              className="block text-xs mb-1"
              style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
            >
              Month
            </label>
            <select
              required
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                handleMonthOrYearChange(e.target.value, year);
              }}
              className="w-full px-4 py-2 text-sm rounded-sm"
              style={inputStyle}
            >
              {MONTHS.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-28">
            <label
              className="block text-xs mb-1"
              style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
            >
              Year
            </label>
            <input
              type="number"
              required
              value={year}
              min="2020"
              max="2099"
              onChange={(e) => {
                setYear(e.target.value);
                handleMonthOrYearChange(month, e.target.value);
              }}
              className="w-full px-4 py-2 text-sm rounded-sm"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label
            className="block text-xs mb-1"
            style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
          >
            Deadline
          </label>
          <input
            type="date"
            required
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-4 py-2 text-sm rounded-sm"
            style={inputStyle}
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full py-2 text-sm text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--forest)", fontFamily: "system-ui, sans-serif" }}
        >
          {status === "loading" ? "Adding…" : "Add Word"}
        </button>
      </form>
    </div>
  );
}
