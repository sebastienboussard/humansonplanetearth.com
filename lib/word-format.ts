// Display helpers for words. Split out of lib/words.ts, which imports the
// Supabase client at module scope — client components need the formatting
// without pulling supabase-js into their bundle. lib/words.ts re-exports
// everything here, so server callers can keep importing from either.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
