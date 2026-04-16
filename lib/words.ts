import { supabase } from "@/lib/supabase";

export type WordEntry = {
  id: string;
  word: string;
  month: number;
  year: number;
  deadline: string;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
  const { data } = await supabase
    .from("words")
    .select("id, word, month, year, deadline")
    .eq("month", now.getMonth() + 1)
    .eq("year", now.getFullYear())
    .maybeSingle();
  return (data as WordEntry | null) ?? null;
}

export async function getWordBySlug(slug: string): Promise<WordEntry | null> {
  const { data } = await supabase
    .from("words")
    .select("id, word, month, year, deadline")
    .ilike("word", slug)
    .maybeSingle();
  return (data as WordEntry | null) ?? null;
}

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1];
}

export function formatDeadline(deadline: string): string {
  const d = new Date(deadline + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function getDaysRemaining(deadline: string): number {
  const end = new Date(deadline + "T23:59:59Z");
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
