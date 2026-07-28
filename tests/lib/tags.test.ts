import { describe, expect, it } from "vitest";
import { normalizeTag, parseTags, matchesTagQuery } from "@/lib/tags";

describe("normalizeTag", () => {
  it("strips leading hashes and lowercases", () => {
    expect(normalizeTag("#Quiet")).toBe("quiet");
    expect(normalizeTag("###Grief")).toBe("grief");
  });

  it("keeps only letters, digits, hyphens and underscores", () => {
    expect(normalizeTag("night-owl_2")).toBe("night-owl_2");
    expect(normalizeTag("what?!")).toBe("what");
    expect(normalizeTag("café")).toBe("caf");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(normalizeTag("#")).toBe("");
    expect(normalizeTag("   ")).toBe("");
    expect(normalizeTag("!!!")).toBe("");
  });

  it("caps tag length at 30 characters", () => {
    expect(normalizeTag("a".repeat(50))).toHaveLength(30);
  });
});

describe("parseTags", () => {
  it("returns an empty array for empty or missing input", () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags("")).toEqual([]);
    expect(parseTags("   ")).toEqual([]);
  });

  it("splits on whitespace and commas", () => {
    expect(parseTags("#quiet #memory grief")).toEqual(["quiet", "memory", "grief"]);
    expect(parseTags("quiet, memory,grief")).toEqual(["quiet", "memory", "grief"]);
  });

  it("dedupes case-insensitively, preserving first-seen order", () => {
    expect(parseTags("#Quiet quiet #QUIET memory")).toEqual(["quiet", "memory"]);
  });

  it("drops tokens that normalize to nothing", () => {
    expect(parseTags("# !!! quiet")).toEqual(["quiet"]);
  });

  it("caps at 10 tags", () => {
    const many = Array.from({ length: 20 }, (_, i) => `tag${i}`).join(" ");
    expect(parseTags(many)).toHaveLength(10);
  });
});

describe("matchesTagQuery", () => {
  const tags = ["quiet", "memory", "grief"];

  it("matches everything when the query is empty or unusable", () => {
    expect(matchesTagQuery(tags, "")).toBe(true);
    expect(matchesTagQuery(tags, "   ")).toBe(true);
    expect(matchesTagQuery(tags, "#")).toBe(true);
    // even papers with no tags at all stay visible under an empty query
    expect(matchesTagQuery([], "")).toBe(true);
    expect(matchesTagQuery(null, "")).toBe(true);
  });

  it("matches on substrings so partial terms find tags", () => {
    expect(matchesTagQuery(["quietmornings"], "quiet")).toBe(true);
    expect(matchesTagQuery(tags, "mem")).toBe(true);
  });

  it("ignores case and a leading hash in the query", () => {
    expect(matchesTagQuery(tags, "#QUIET")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesTagQuery(tags, "xyz")).toBe(false);
    expect(matchesTagQuery([], "quiet")).toBe(false);
    expect(matchesTagQuery(null, "quiet")).toBe(false);
    expect(matchesTagQuery(undefined, "quiet")).toBe(false);
  });

  it("treats a multi-word query as separate terms (OR match)", () => {
    // regression: the whole query used to collapse to "quietmemory"
    expect(matchesTagQuery(tags, "quiet memory")).toBe(true);
    expect(matchesTagQuery(["quiet"], "quiet memory")).toBe(true);
    expect(matchesTagQuery(["unrelated"], "quiet memory")).toBe(false);
  });
});
