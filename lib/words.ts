import wordsData from "@/data/words.json";

export type WordEntry = {
  word: string;
  month: number;
  year: number;
  deadline: string;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getAllWords(): WordEntry[] {
  return [...wordsData].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

export function getCurrentWord(): WordEntry | null {
  const now = new Date();
  return (
    wordsData.find(
      (w) => w.month === now.getMonth() + 1 && w.year === now.getFullYear()
    ) ?? null
  );
}

export function getWordBySlug(slug: string): WordEntry | null {
  return wordsData.find((w) => w.word.toLowerCase() === slug.toLowerCase()) ?? null;
}

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1];
}

export function formatDeadline(deadline: string): string {
  const d = new Date(deadline + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function getDaysRemaining(deadline: string): number {
  const end = new Date(deadline + "T23:59:59");
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
