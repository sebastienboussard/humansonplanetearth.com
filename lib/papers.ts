// Reading order for a word's papers. The server hands the carousel a list
// already in the word's default order; the reader can flip it from the page,
// so the sort has to be reproducible on the client rather than a reversal of
// whatever order happened to arrive.

export type SortOrder = "newest" | "oldest";

export function sortOrderFor(newestFirst: boolean): SortOrder {
  return newestFirst ? "newest" : "oldest";
}

// Sort by submission time without mutating the input. Papers submitted at the
// same instant keep their incoming order (Array#sort is stable), and an
// unparseable timestamp sorts as 0 rather than poisoning the comparison with
// NaN, which would leave the whole list in an arbitrary order.
export function sortPapersByDate<T extends { submitted_at: string }>(
  papers: T[],
  order: SortOrder
): T[] {
  const direction = order === "newest" ? -1 : 1;
  return [...papers].sort((a, b) => {
    const diff = timestamp(a.submitted_at) - timestamp(b.submitted_at);
    return diff * direction;
  });
}

function timestamp(value: string): number {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}
