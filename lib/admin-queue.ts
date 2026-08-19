// Queue bookkeeping for the admin dashboard.
//
// The pending queue and the published history used to be owned by two sibling
// components that each fetched once and never spoke to each other, so approving
// a paper dropped it from one list without ever adding it to the other. The
// moves live here, as pure functions, so the behaviour can be tested without a
// DOM and so both lists can only ever change together.

import { sortPapersByDate } from "@/lib/papers";

export type AdminPaper = {
  id: string;
  type: string;
  title: string | null;
  submitted_at: string;
  signed_url: string | null;
  words: { word: string; month: number; year: number } | null;
};

export type AdminMessage = {
  id: string;
  body: string;
  reply_email: string | null;
  read: boolean;
  created_at: string;
};

// What a paper is called in a list: long-form papers go by their title, word
// papers by their word.
export function paperLabel(paper: Pick<AdminPaper, "type" | "title" | "words">): string {
  if (paper.type === "long-form" && paper.title) return paper.title;
  return paper.words?.word ?? paper.title ?? "Unknown word";
}

// Published papers read newest-first. The list was previously sorted
// alphabetically by word, which buried each new arrival among the papers for
// the same word — the whole point of the history is to see what just landed.
export function sortPublished<T extends { submitted_at: string }>(papers: T[]): T[] {
  return sortPapersByDate(papers, "newest");
}

// Approving a paper: it leaves the pending queue and joins the published
// history in the same step. Returns new arrays; neither input is mutated.
// An unknown id is a no-op, and a paper already in `published` is not
// duplicated — a double-click on Approve must not produce two rows.
export function movePaperToPublished<T extends { id: string; submitted_at: string }>(
  pending: T[],
  published: T[],
  id: string
): { pending: T[]; published: T[] } {
  const paper = pending.find((p) => p.id === id);
  if (!paper) return { pending: [...pending], published: [...published] };

  const alreadyPublished = published.some((p) => p.id === id);
  return {
    pending: pending.filter((p) => p.id !== id),
    published: alreadyPublished ? [...published] : sortPublished([paper, ...published]),
  };
}

// Rejecting a paper: it leaves the queue and joins nothing.
export function removePaper<T extends { id: string }>(papers: T[], id: string): T[] {
  return papers.filter((p) => p.id !== id);
}

// Free-text filter for the published history, which only grows. Matches the
// word and the title; invisible hashtags are deliberately not searched here —
// they are author metadata and the admin list never renders them.
export function filterPapers<T extends Pick<AdminPaper, "type" | "title" | "words">>(
  papers: T[],
  query: string
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...papers];
  return papers.filter((p) => {
    const haystack = [p.words?.word, p.title, paperLabel(p)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function unreadCount(messages: Pick<AdminMessage, "read">[]): number {
  return messages.filter((m) => !m.read).length;
}
