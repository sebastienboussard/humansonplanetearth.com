import { describe, expect, it } from "vitest";
import { WHATS_NEW, CHANGELOG_URL, REPO_URL } from "@/data/whats-new";

describe("WHATS_NEW entries", () => {
  it("has at least one entry", () => {
    expect(WHATS_NEW.length).toBeGreaterThan(0);
  });

  it("every entry has a non-empty title and blurb", () => {
    for (const entry of WHATS_NEW) {
      expect(entry.title.trim()).not.toBe("");
      expect(entry.blurb.trim()).not.toBe("");
    }
  });

  it("every date is ISO YYYY-MM-DD and parses to a valid date", () => {
    for (const entry of WHATS_NEW) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(entry.date))).toBe(false);
    }
  });

  it("is sorted newest first", () => {
    for (let i = 1; i < WHATS_NEW.length; i++) {
      expect(WHATS_NEW[i - 1].date >= WHATS_NEW[i].date).toBe(true);
    }
  });

  it("has no duplicate titles (used as React keys)", () => {
    const titles = WHATS_NEW.map((e) => e.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("hrefs, when present, are site-relative", () => {
    for (const entry of WHATS_NEW) {
      if (entry.href !== undefined) {
        expect(entry.href.startsWith("/")).toBe(true);
      }
    }
  });
});

describe("outbound links", () => {
  it("points the changelog at CHANGELOG.md on the default branch", () => {
    expect(CHANGELOG_URL).toBe(`${REPO_URL}/blob/main/CHANGELOG.md`);
  });

  it("uses the public repo URL", () => {
    expect(REPO_URL).toMatch(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/);
  });
});
