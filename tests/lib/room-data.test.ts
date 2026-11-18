import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import { marginCounts, pageHandle, whereToFind } from "@/lib/room-data";

afterEach(() => {
  holder.current = null;
});

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

describe("pageHandle", () => {
  const page = { title: null, body: "A body.", quote: null, locator: null };

  it("uses the title when there is one", () => {
    expect(pageHandle({ ...page, title: "  On debt " })).toBe("On debt");
  });

  it("falls back to where the quote is from and how it starts", () => {
    expect(pageHandle({ ...page, quote: "It is a narrow mind", locator: "p. 112" })).toBe("p. 112 — “It is a narrow mind”");
    expect(pageHandle({ ...page, quote: "It is a narrow mind" })).toBe("“It is a narrow mind”");
  });

  it("falls back to the start of the body, cut on a word", () => {
    const body = "Lydgate's debts are the quiet engine of the whole middle of the book,\n and nobody says so";
    const handle = pageHandle({ ...page, body });
    expect(handle).toBe("Lydgate's debts are the quiet engine of the whole middle of the book…");
    expect(handle.length).toBeLessThanOrEqual(71);
  });

  it("leaves a short body whole", () => {
    expect(pageHandle(page)).toBe("A body.");
  });
});

describe("marginCounts", () => {
  it("counts margins per page from ids only", async () => {
    holder.current = createMockSupabase({
      tables: { room_margins: { data: [{ page_id: "p1" }, { page_id: "p1" }, { page_id: "p2" }] } },
    });
    expect(await marginCounts(["p1", "p2", "p3"])).toEqual({ p1: 2, p2: 1 });
    const q = holder.current.query("room_margins")!;
    expect(q.select).toHaveBeenCalledWith("page_id");
    expect(q.in).toHaveBeenCalledWith("page_id", ["p1", "p2", "p3"]);
  });

  it("asks nothing for no pages", async () => {
    holder.current = createMockSupabase();
    expect(await marginCounts([])).toEqual({});
    expect(holder.current.query("room_margins")).toBeUndefined();
  });
});
