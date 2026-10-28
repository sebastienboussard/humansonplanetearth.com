import { describe, expect, it } from "vitest";
import {
  WHOLE_WORK_LABEL,
  buildSections,
  cleanText,
  cleanYear,
  isMedium,
  parseRoom,
  sectionsProblem,
  slugWithSuffix,
  slugify,
} from "@/lib/rooms";

describe("slugify", () => {
  it.each([
    ["Middlemarch", "middlemarch"],
    ["One Hundred Years of Solitude", "one-hundred-years-of-solitude"],
    ["Amélie", "amelie"],
    ["  2001: A Space Odyssey!  ", "2001-a-space-odyssey"],
    ["Don't Look Now", "don-t-look-now"],
    ["百年孤独", "room"],
    ["---", "room"],
  ])("%j → %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it("stays within 60 characters and never ends on a hyphen", () => {
    const slug = slugify("a ".repeat(100));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("always matches the column's CHECK", () => {
    for (const t of ["Hello, World", "x".repeat(300), "Ça va?", "!!!"]) {
      expect(slugify(t)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe("slugWithSuffix", () => {
  it("adds a four-character suffix that still matches the CHECK", () => {
    const slug = slugWithSuffix("middlemarch", () => 0.5);
    expect(slug).toMatch(/^middlemarch-[a-z2-9]{4}$/);
    expect(slugWithSuffix(slugify("x".repeat(100)))).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(slugWithSuffix(slugify("x".repeat(100))).length).toBeLessThanOrEqual(80);
  });
});

describe("buildSections", () => {
  it("keeps the creator's order and always ends with the whole work", () => {
    expect(buildSections(["Chapter 1", "Chapter 2"])).toEqual([
      { label: "Chapter 1", kind: "part" },
      { label: "Chapter 2", kind: "part" },
      { label: WHOLE_WORK_LABEL, kind: "whole" },
    ]);
  });

  it("drops blank labels and trims the rest", () => {
    expect(buildSections(["  Act I ", "", "   ", 7, "Act II"]).map((s) => s.label)).toEqual([
      "Act I",
      "Act II",
      WHOLE_WORK_LABEL,
    ]);
  });

  it("gives a room with no breakdown just the whole work", () => {
    expect(buildSections(undefined)).toEqual([{ label: WHOLE_WORK_LABEL, kind: "whole" }]);
    expect(buildSections([])).toEqual([{ label: WHOLE_WORK_LABEL, kind: "whole" }]);
  });

  it("can't be talked into a second whole-work section", () => {
    const sections = buildSections(["The whole work"]);
    expect(sections.filter((s) => s.kind === "whole")).toHaveLength(1);
  });
});

describe("sectionsProblem", () => {
  it("accepts an ordinary breakdown", () => {
    expect(sectionsProblem(buildSections(["One", "Two"]))).toBeNull();
  });

  it("refuses too many sections or a label that is too long", () => {
    expect(sectionsProblem(buildSections(Array.from({ length: 61 }, (_, i) => `Ch ${i}`)))).toMatch(/at most 60/);
    expect(sectionsProblem(buildSections(["x".repeat(121)]))).toMatch(/120 characters/);
  });
});

describe("cleanText / cleanYear / isMedium", () => {
  it("trims, and turns blanks and non-strings into null", () => {
    expect(cleanText("  hi ")).toBe("hi");
    expect(cleanText("   ")).toBeNull();
    expect(cleanText(42)).toBeNull();
  });

  it("accepts whole years in range only", () => {
    expect(cleanYear("1871")).toBe(1871);
    expect(cleanYear(-800)).toBe(-800);
    expect(cleanYear("1871.5")).toBeNull();
    expect(cleanYear("soon")).toBeNull();
    expect(cleanYear(99999)).toBeNull();
  });

  it("knows the five mediums", () => {
    expect(isMedium("film")).toBe(true);
    expect(isMedium("podcast")).toBe(false);
  });
});

describe("parseRoom", () => {
  const base = { title: " Middlemarch ", medium: "book", sections: ["One"] };

  it("cleans a good room", () => {
    expect(parseRoom({ ...base, creator: "", year: "1871" })).toEqual({
      room: {
        title: "Middlemarch",
        creator: null,
        medium: "book",
        year: 1871,
        intro: null,
        sections: [
          { label: "One", kind: "part" },
          { label: WHOLE_WORK_LABEL, kind: "whole" },
        ],
      },
    });
  });

  it.each([
    [{ ...base, title: "" }, /title/],
    [{ ...base, medium: "podcast" }, /kind of work/],
    [{ ...base, year: "soon" }, /whole number/],
    [{ ...base, intro: "x".repeat(2001) }, /introduction/],
  ])("explains what is wrong", (input, message) => {
    const result = parseRoom(input);
    expect("error" in result && result.error).toMatch(message);
  });
});
