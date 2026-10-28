import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { USER_AGENT, coverUrl, isCoverId, isWorkKey, parseSearch, searchWorks, workUrl } from "@/lib/open-library";

// Recorded from openlibrary.org on 2026-10-27, so these tests are about the
// real shape of its responses, not a guess at it.
const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, "../fixtures/open-library", name), "utf8"));

describe("parseSearch", () => {
  it("reads a real search response", () => {
    const works = parseSearch(fixture("search-middlemarch.json"));
    expect(works).toHaveLength(5);
    expect(works[0]).toEqual({
      key: "/works/OL20867W",
      title: "Middlemarch",
      author: "George Eliot",
      year: 1800, // Open Library's own (wrong) year; the form leaves it editable
      coverId: 252882,
    });
    expect(works.find((w) => w.key === "/works/OL25411286W")?.coverId).toBeNull();
    expect(works.find((w) => w.key === "/works/OL40809918W")?.author).toBe("George Eliot, Gabriela Henriquez");
  });

  it("reads an empty result", () => {
    expect(parseSearch(fixture("search-empty.json"))).toEqual([]);
  });

  it("skips malformed works rather than failing the list", () => {
    const works = parseSearch({
      docs: [
        { key: "/books/OL1M", title: "An edition, not a work" },
        { key: "/works/OL1W", title: "   " },
        { key: "/works/OL2W", title: "Fine", author_name: [42, "Real Author"], first_publish_year: 99999, cover_i: -1 },
        null,
      ],
    });
    expect(works).toEqual([{ key: "/works/OL2W", title: "Fine", author: "Real Author", year: null, coverId: null }]);
  });

  it.each([null, {}, { docs: "no" }, "text"])("is empty for a response that isn't one (%j)", (json) => {
    expect(parseSearch(json)).toEqual([]);
  });

  it("keeps at most eight", () => {
    const docs = Array.from({ length: 12 }, (_, i) => ({ key: `/works/OL${i + 1}W`, title: `T${i}` }));
    expect(parseSearch({ docs })).toHaveLength(8);
  });
});

describe("searchWorks", () => {
  it("asks Open Library with a User-Agent, a timeout and a day's cache", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(fixture("search-middlemarch.json"))));
    const works = await searchWorks("middle march", fetchImpl as unknown as typeof fetch);
    expect(works).toHaveLength(5);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit & { next?: { revalidate: number } }];
    expect(url).toMatch(/^https:\/\/openlibrary\.org\/search\.json\?/);
    expect(new URL(url).searchParams.get("q")).toBe("middle march");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(USER_AGENT);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.next?.revalidate).toBe(86400);
  });

  it("throws on a non-2xx, for the route to turn into 'unavailable'", async () => {
    const fetchImpl = vi.fn(async () => new Response("busy", { status: 503 }));
    await expect(searchWorks("x", fetchImpl as unknown as typeof fetch)).rejects.toThrow(/503/);
  });
});

describe("helpers", () => {
  it("checks keys and covers the way the database does", () => {
    expect(isWorkKey("/works/OL20867W")).toBe(true);
    expect(isWorkKey("/works/OL20867W/x")).toBe(false);
    expect(isWorkKey("https://evil.example/works/OL1W")).toBe(false);
    expect(isCoverId(252882)).toBe(true);
    expect(isCoverId(0)).toBe(false);
    expect(isCoverId("252882")).toBe(false);
  });

  it("builds Open Library's URLs", () => {
    expect(coverUrl(252882, "S")).toBe("https://covers.openlibrary.org/b/id/252882-S.jpg");
    expect(workUrl("/works/OL20867W")).toBe("https://openlibrary.org/works/OL20867W");
  });
});
