// Ordering for the word queue (TODO §20). Pure, like lib/admin-queue.ts, so
// it is testable without a DOM or a database.
//
// Fair, not first-come-first-served. A word's round is its position among its
// own author's *waiting* words, oldest first. The queue sorts by round, then by
// age, so everyone's first waiting word comes before anyone's second. The round
// is derived here at read time and never stored, so there is nothing to assign
// under a race and nothing to renumber when a word leaves the queue.
// DECISIONS.md, 2026-09-15, has the trade this makes.

/**
 * Waiting words per account. Must match the trigger in
 * supabase/migrations/0004_word_proposals.sql, which is what enforces it.
 */
export const MAX_WAITING = 3;

export type WaitingProposal = {
  id: string;
  profile_id: string;
  word: string;
  created_at: string;
};

export type QueuedWord = {
  id: string;
  word: string;
  created_at: string;
  round: number;
};

function byAge(a: { created_at: string; id: string }, b: { created_at: string; id: string }) {
  // created_at carries no uniqueness, so ties break on id and the order is
  // stable from one load to the next.
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Waiting proposals in queue order, each with its round. The result carries
 * **no profile_id**: the admin needs the round, not who proposed the word.
 */
export function orderWordQueue(waiting: WaitingProposal[]): QueuedWord[] {
  const seen = new Map<string, number>();
  const withRound = [...waiting].sort(byAge).map((p) => {
    const round = (seen.get(p.profile_id) ?? 0) + 1;
    seen.set(p.profile_id, round);
    return { id: p.id, word: p.word, created_at: p.created_at, round };
  });
  return withRound.sort((a, b) => a.round - b.round || byAge(a, b));
}
