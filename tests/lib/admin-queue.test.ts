import { describe, expect, it } from "vitest";
import {
  filterPapers,
  movePaperToPublished,
  paperLabel,
  removePaper,
  sortPublished,
  unreadCount,
} from "@/lib/admin-queue";

const paper = (id: string, submitted_at: string, extra: object = {}) => ({
  id,
  type: "word",
  title: null as string | null,
  submitted_at,
  signed_url: null,
  words: { word: "regret", month: 7, year: 2026 },
  ...extra,
});

const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe("sortPublished", () => {
  it("puts the most recent submission first", () => {
    const list = [
      paper("old", "2026-06-01T10:00:00Z"),
      paper("new", "2026-07-20T10:00:00Z"),
      paper("mid", "2026-07-10T10:00:00Z"),
    ];
    expect(ids(sortPublished(list))).toEqual(["new", "mid", "old"]);
  });

  it("does not mutate the input", () => {
    const list = [paper("a", "2026-06-01T10:00:00Z"), paper("b", "2026-07-01T10:00:00Z")];
    sortPublished(list);
    expect(ids(list)).toEqual(["a", "b"]);
  });
});

// Regression guard for the missing-published-history bug: approving a paper
// used to drop it from the pending component's local state without the
// published list ever hearing about it.
describe("movePaperToPublished", () => {
  const pending = [
    paper("p1", "2026-07-25T10:00:00Z"),
    paper("p2", "2026-07-26T10:00:00Z"),
  ];
  const published = [
    paper("done1", "2026-07-01T10:00:00Z"),
    paper("done2", "2026-07-15T10:00:00Z"),
  ];

  it("moves the approved paper out of pending and into published", () => {
    const result = movePaperToPublished(pending, published, "p1");
    expect(ids(result.pending)).toEqual(["p2"]);
    expect(ids(result.published)).toContain("p1");
  });

  it("puts the freshly approved paper first — it is the newest", () => {
    const result = movePaperToPublished(pending, published, "p2");
    expect(ids(result.published)[0]).toBe("p2");
  });

  it("keeps the published history newest-first overall", () => {
    const result = movePaperToPublished(pending, published, "p1");
    expect(ids(result.published)).toEqual(["p1", "done2", "done1"]);
  });

  it("is a no-op for an unknown id", () => {
    const result = movePaperToPublished(pending, published, "nope");
    expect(ids(result.pending)).toEqual(["p1", "p2"]);
    expect(ids(result.published)).toEqual(["done1", "done2"]);
  });

  it("does not duplicate a paper already in published (double-click)", () => {
    const first = movePaperToPublished(pending, published, "p1");
    const second = movePaperToPublished(pending, first.published, "p1");
    // p1 is gone from pending after the first move, so the second finds nothing
    expect(ids(second.published).filter((id) => id === "p1")).toHaveLength(1);

    // Even if pending somehow still held it, published must not gain a twin
    const forced = movePaperToPublished(pending, first.published, "p1");
    expect(ids(forced.published).filter((id) => id === "p1")).toHaveLength(1);
  });

  it("mutates neither input array", () => {
    movePaperToPublished(pending, published, "p1");
    expect(ids(pending)).toEqual(["p1", "p2"]);
    expect(ids(published)).toEqual(["done1", "done2"]);
  });
});

describe("removePaper", () => {
  it("removes by id without mutating the input", () => {
    const list = [paper("a", "2026-07-01T10:00:00Z"), paper("b", "2026-07-02T10:00:00Z")];
    expect(ids(removePaper(list, "a"))).toEqual(["b"]);
    expect(ids(list)).toEqual(["a", "b"]);
  });
});

describe("paperLabel", () => {
  it("uses the title for long-form papers", () => {
    expect(
      paperLabel({ type: "long-form", title: "On Grief", words: null })
    ).toBe("On Grief");
  });

  it("uses the word for word papers", () => {
    expect(
      paperLabel({ type: "word", title: null, words: { word: "regret", month: 7, year: 2026 } })
    ).toBe("regret");
  });

  it("falls back when neither is available", () => {
    expect(paperLabel({ type: "word", title: null, words: null })).toBe("Unknown word");
  });
});

describe("filterPapers", () => {
  const list = [
    paper("r1", "2026-07-01T10:00:00Z"),
    paper("lf", "2026-07-02T10:00:00Z", {
      type: "long-form",
      title: "Letters to Nobody",
      words: null,
    }),
    paper("s1", "2026-04-01T10:00:00Z", { words: { word: "stardust", month: 4, year: 2026 } }),
  ];

  it("matches on word, case-insensitively", () => {
    expect(ids(filterPapers(list, "REGRET"))).toEqual(["r1"]);
  });

  it("matches on long-form title", () => {
    expect(ids(filterPapers(list, "nobody"))).toEqual(["lf"]);
  });

  it("returns everything for a blank query", () => {
    expect(ids(filterPapers(list, "   "))).toEqual(["r1", "lf", "s1"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterPapers(list, "zzz")).toEqual([]);
  });
});

describe("unreadCount", () => {
  it("counts only unread messages", () => {
    expect(unreadCount([{ read: false }, { read: true }, { read: false }])).toBe(2);
  });

  it("is zero for an empty inbox", () => {
    expect(unreadCount([])).toBe(0);
  });
});
