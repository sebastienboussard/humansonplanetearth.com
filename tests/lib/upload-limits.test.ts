import { describe, expect, it } from "vitest";
import {
  WORD_MAX_SIZE,
  LONG_FORM_MAX_SIZE,
  formatBytes,
  oversizeMessage,
} from "@/lib/upload-limits";

describe("upload limits", () => {
  it("keeps long-form under Vercel's ~4.5 MB request body cap", () => {
    // Above this the platform rejects the request before our handler runs, so
    // the limit would be unenforceable and the error message would not be ours.
    expect(LONG_FORM_MAX_SIZE).toBeLessThan(4.5 * 1024 * 1024);
  });

  it("keeps the one-page word limit tighter than long-form", () => {
    expect(WORD_MAX_SIZE).toBeLessThan(LONG_FORM_MAX_SIZE);
  });
});

describe("formatBytes", () => {
  it("uses MB with one decimal at or above a megabyte", () => {
    expect(formatBytes(4 * 1024 * 1024)).toBe("4.0 MB");
    expect(formatBytes(6.75 * 1024 * 1024)).toBe("6.8 MB");
  });

  it("uses whole KB below a megabyte", () => {
    expect(formatBytes(812 * 1024)).toBe("812 KB");
    expect(formatBytes(0)).toBe("0 KB");
  });
});

describe("oversizeMessage", () => {
  it("names the file's actual size, not just the cap", () => {
    // "File must be under 4 MB" leaves someone holding a 4.1 MB PDF unsure
    // whether they are marginally or wildly over.
    const msg = oversizeMessage(6.4 * 1024 * 1024, LONG_FORM_MAX_SIZE);

    expect(msg).toContain("6.4 MB");
    expect(msg).toContain("4.0 MB");
  });

  it("tells the reader what to do about it", () => {
    expect(oversizeMessage(3 * 1024 * 1024, WORD_MAX_SIZE)).toMatch(/compress|quality/i);
  });
});
