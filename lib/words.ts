import { supabase } from "@/lib/supabase";

export { getMonthName, formatDeadline, getDaysRemaining } from "@/lib/word-format";

export type WordEntry = {
  id: string;
  word: string;
  month: number;
  year: number;
  deadline: string;
};

export async function getAllWords(): Promise<WordEntry[]> {
  const { data } = await supabase
    .from("words")
    .select("id, word, month, year, deadline")
    .neq("word", "__long-form__")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  return (data ?? []) as WordEntry[];
}

export async function getCurrentWord(): Promise<WordEntry | null> {
  const now = new Date();
  // Try to find a word for the current month first
  const { data: current } = await supabase
    .from("words")
    .select("id, word, month, year, deadline")
    .eq("month", now.getMonth() + 1)
    .eq("year", now.getFullYear())
    .maybeSingle();
  if (current) return current as WordEntry;

  // Fall back to the most recent word until a new one is chosen
  const { data: latest } = await supabase
    .from("words")
    .select("id, word, month, year, deadline")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (latest as WordEntry | null) ?? null;
}

export async function getWordBySlug(slug: string): Promise<WordEntry | null> {
  const { data } = await supabase
    .from("words")
    .select("id, word, month, year, deadline")
    .ilike("word", slug)
    .maybeSingle();
  return (data as WordEntry | null) ?? null;
}

// Papers used to read oldest-first. From "regret" (July 2026) onward the most
// recent submission leads instead; earlier words keep the order they shipped with.
const NEWEST_FIRST_FROM = { year: 2026, month: 7 };

// The word immediately before this one, or null if this is the first. Used
// wherever a reader arrives at a word with nothing published yet — the first
// days of a new month — so the page has somewhere to send them instead of
// ending on "Be the first". Ordering is by month, never by deadline: a
// deadline can be edited after the fact, the month cannot.
export async function getPreviousWord(
  entry: Pick<WordEntry, "month" | "year">
): Promise<WordEntry | null> {
  const rank = entry.year * 12 + entry.month;
  // Fetched rather than compared in SQL because "year desc, month desc" cannot
  // express "strictly before this year+month" in one PostgREST filter. The
  // words table is one row a month; the whole list is small by construction.
  const words = await getAllWords();
  return words.find((w) => w.year * 12 + w.month < rank) ?? null;
}

export function showsNewestPapersFirst(entry: Pick<WordEntry, "month" | "year">): boolean {
  return (
    entry.year * 12 + entry.month >=
    NEWEST_FIRST_FROM.year * 12 + NEWEST_FIRST_FROM.month
  );
}

