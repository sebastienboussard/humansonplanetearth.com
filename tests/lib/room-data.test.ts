import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { whereToFind } from "@/lib/room-data";

describe("whereToFind", () => {
  it("puts the Open Library work first, then the opener's links", () => {
    expect(
      whereToFind({ ol_work_key: "/works/OL20867W", links: [{ url: "https://www.gutenberg.org/ebooks/145" }] })
    ).toEqual([
      { url: "https://openlibrary.org/works/OL20867W", label: "Open Library" },
      { url: "https://www.gutenberg.org/ebooks/145", label: "gutenberg.org" },
    ]);
  });

  it("doesn't list the same Open Library page twice", () => {
    const links = whereToFind({ ol_work_key: "/works/OL1W", links: [{ url: "https://openlibrary.org/works/OL1W" }] });
    expect(links).toHaveLength(1);
  });

  it("is empty for a room with neither", () => {
    expect(whereToFind({ ol_work_key: null, links: null })).toEqual([]);
  });
});
