import { describe, expect, it } from "vitest";
import { sortPapersByDate, sortOrderFor } from "@/lib/papers";

const papers = [
  { id: "a", submitted_at: "2026-07-01T10:00:00Z" },
  { id: "b", submitted_at: "2026-07-20T10:00:00Z" },
  { id: "c", submitted_at: "2026-07-10T10:00:00Z" },
];

const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe("sortOrderFor", () => {
  it("maps the word's default flag onto an order", () => {
    expect(sortOrderFor(true)).toBe("newest");
    expect(sortOrderFor(false)).toBe("oldest");
  });
});

describe("sortPapersByDate", () => {
  it("puts the most recent submission first for 'newest'", () => {
    expect(ids(sortPapersByDate(papers, "newest"))).toEqual(["b", "c", "a"]);
  });

  it("puts the earliest submission first for 'oldest'", () => {
    expect(ids(sortPapersByDate(papers, "oldest"))).toEqual(["a", "c", "b"]);
  });

  it("leaves the input array untouched", () => {
    sortPapersByDate(papers, "newest");
    expect(ids(papers)).toEqual(["a", "b", "c"]);
  });

  it("keeps the incoming order for papers submitted at the same instant", () => {
    const tied = [
      { id: "x", submitted_at: "2026-07-05T09:00:00Z" },
      { id: "y", submitted_at: "2026-07-05T09:00:00Z" },
      { id: "z", submitted_at: "2026-07-05T09:00:00Z" },
    ];
    expect(ids(sortPapersByDate(tied, "newest"))).toEqual(["x", "y", "z"]);
    expect(ids(sortPapersByDate(tied, "oldest"))).toEqual(["x", "y", "z"]);
  });

  it("does not scramble the list when a timestamp is unparseable", () => {
    const broken = [
      { id: "good-late", submitted_at: "2026-07-20T10:00:00Z" },
      { id: "broken", submitted_at: "not a date" },
      { id: "good-early", submitted_at: "2026-07-01T10:00:00Z" },
    ];
    expect(ids(sortPapersByDate(broken, "newest"))).toEqual([
      "good-late",
      "good-early",
      "broken",
    ]);
  });

  it("sorts an empty list and a single paper without complaint", () => {
    expect(sortPapersByDate([], "newest")).toEqual([]);
    expect(ids(sortPapersByDate([papers[0]], "oldest"))).toEqual(["a"]);
  });
});
