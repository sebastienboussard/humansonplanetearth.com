import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import {
  getAllWords,
  getCurrentWord,
  getWordBySlug,
  getPreviousWord,
  getMonthName,
  formatDeadline,
  getDaysRemaining,
  showsNewestPapersFirst,
} from "@/lib/words";

afterEach(() => {
  holder.current = null;
  vi.useRealTimers();
});

describe("getMonthName", () => {
  it("maps 1-indexed months to English names", () => {
    expect(getMonthName(1)).toBe("January");
    expect(getMonthName(7)).toBe("July");
    expect(getMonthName(12)).toBe("December");
  });
});

describe("formatDeadline", () => {
  it("formats an ISO date as a long en-US date", () => {
    expect(formatDeadline("2026-07-31")).toBe("July 31, 2026");
  });

  it("is stable across month boundaries (UTC)", () => {
    expect(formatDeadline("2026-01-01")).toBe("January 1, 2026");
    expect(formatDeadline("2026-12-31")).toBe("December 31, 2026");
  });
});

describe("getDaysRemaining", () => {
  it("counts days until end-of-day UTC on the deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:00:00Z"));
    expect(getDaysRemaining("2026-07-31")).toBe(4);
  });

  it("returns 1 on the deadline day itself", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));
    expect(getDaysRemaining("2026-07-31")).toBe(1);
  });

  it("never goes negative after the deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T00:00:00Z"));
    expect(getDaysRemaining("2026-07-31")).toBe(0);
  });
});

describe("showsNewestPapersFirst", () => {
  it("is on for regret, the July 2026 word", () => {
    expect(showsNewestPapersFirst({ month: 7, year: 2026 })).toBe(true);
  });

  it("stays off for every word before the cutover", () => {
    expect(showsNewestPapersFirst({ month: 6, year: 2026 })).toBe(false);
    expect(showsNewestPapersFirst({ month: 1, year: 2026 })).toBe(false);
    expect(showsNewestPapersFirst({ month: 12, year: 2025 })).toBe(false);
  });

  it("stays on for later words, including across the year boundary", () => {
    expect(showsNewestPapersFirst({ month: 8, year: 2026 })).toBe(true);
    expect(showsNewestPapersFirst({ month: 1, year: 2027 })).toBe(true);
  });
});

describe("getAllWords", () => {
  it("returns rows and excludes the long-form sentinel word", async () => {
    const rows = [
      { id: "w2", word: "hope", month: 7, year: 2026, deadline: "2026-07-31" },
      { id: "w1", word: "trust", month: 6, year: 2026, deadline: "2026-06-30" },
    ];
    holder.current = createMockSupabase({ tables: { words: { data: rows } } });

    const words = await getAllWords();

    expect(words).toEqual(rows);
    const q = holder.current.query("words")!;
    expect(q.neq).toHaveBeenCalledWith("word", "__long-form__");
  });

  it("returns an empty array when the query yields no data", async () => {
    holder.current = createMockSupabase({ tables: { words: { data: null } } });
    expect(await getAllWords()).toEqual([]);
  });
});

describe("getPreviousWord", () => {
  // getAllWords already returns newest first and drops the long-form sentinel,
  // so these rows are what the helper actually sees.
  const rows = [
    { id: "w3", word: "silence", month: 1, year: 2027, deadline: "2027-01-31" },
    { id: "w2", word: "hope", month: 12, year: 2026, deadline: "2026-12-31" },
    { id: "w1", word: "trust", month: 6, year: 2026, deadline: "2026-06-30" },
  ];

  it("returns the word immediately before the one given", async () => {
    holder.current = createMockSupabase({ tables: { words: { data: rows } } });
    expect(await getPreviousWord({ month: 12, year: 2026 })).toEqual(rows[2]);
  });

  it("crosses the year boundary", async () => {
    holder.current = createMockSupabase({ tables: { words: { data: rows } } });
    // January 2027 → December 2026, not the other January.
    expect(await getPreviousWord({ month: 1, year: 2027 })).toEqual(rows[1]);
  });

  it("returns null for the earliest word", async () => {
    holder.current = createMockSupabase({ tables: { words: { data: rows } } });
    expect(await getPreviousWord({ month: 6, year: 2026 })).toBeNull();
  });

  it("skips the long-form sentinel, because getAllWords filters it out", async () => {
    holder.current = createMockSupabase({ tables: { words: { data: rows } } });
    await getPreviousWord({ month: 12, year: 2026 });
    expect(holder.current.query("words")!.neq).toHaveBeenCalledWith("word", "__long-form__");
  });

  it("returns null when there are no words at all", async () => {
    holder.current = createMockSupabase({ tables: { words: { data: null } } });
    expect(await getPreviousWord({ month: 7, year: 2026 })).toBeNull();
  });
});

describe("getCurrentWord", () => {
  it("returns the word matching the current month and year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    const current = { id: "w2", word: "hope", month: 7, year: 2026, deadline: "2026-07-31" };
    holder.current = createMockSupabase({ tables: { words: { data: current } } });

    expect(await getCurrentWord()).toEqual(current);
    const q = holder.current.query("words")!;
    expect(q.eq).toHaveBeenCalledWith("month", 7);
    expect(q.eq).toHaveBeenCalledWith("year", 2026);
  });

  it("falls back to the most recent word when the current month has none", async () => {
    const latest = { id: "w1", word: "trust", month: 6, year: 2026, deadline: "2026-06-30" };
    holder.current = createMockSupabase({
      tables: { words: [{ data: null }, { data: latest }] },
    });

    expect(await getCurrentWord()).toEqual(latest);
    expect(holder.current.from).toHaveBeenCalledTimes(2);
  });

  it("returns null when no words exist at all", async () => {
    holder.current = createMockSupabase({
      tables: { words: [{ data: null }, { data: null }] },
    });
    expect(await getCurrentWord()).toBeNull();
  });
});

describe("getWordBySlug", () => {
  it("matches the slug case-insensitively", async () => {
    const row = { id: "w2", word: "hope", month: 7, year: 2026, deadline: "2026-07-31" };
    holder.current = createMockSupabase({ tables: { words: { data: row } } });

    expect(await getWordBySlug("HOPE")).toEqual(row);
    const q = holder.current.query("words")!;
    expect(q.ilike).toHaveBeenCalledWith("word", "HOPE");
  });

  it("returns null for an unknown slug", async () => {
    holder.current = createMockSupabase({ tables: { words: { data: null } } });
    expect(await getWordBySlug("nonexistent")).toBeNull();
  });
});
