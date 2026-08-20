import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_SIZE,
  WORD_MAX_SIZE,
  LONG_FORM_MAX_SIZE,
  formatBytes,
  oversizeMessage,
  nearLimitMessage,
  submitFailureMessage,
} from "@/lib/upload-limits";

describe("upload limits", () => {
  it("sits at Vercel's ~4.5 MB request body cap, never above it", () => {
    // Above this the platform rejects the request before our handler runs, so
    // the limit would be unenforceable and the error message would not be ours.
    expect(MAX_UPLOAD_SIZE).toBeLessThanOrEqual(4.5 * 1024 * 1024);
  });

  it("gives word and long-form the same allowance", () => {
    expect(WORD_MAX_SIZE).toBe(MAX_UPLOAD_SIZE);
    expect(LONG_FORM_MAX_SIZE).toBe(MAX_UPLOAD_SIZE);
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
    expect(msg).toContain("4.5 MB");
  });

  it("tells the reader what to do about it", () => {
    expect(oversizeMessage(5 * 1024 * 1024, WORD_MAX_SIZE)).toMatch(/compress|quality/i);
  });
});

describe("nearLimitMessage", () => {
  it("explains a file the limit accepts but the upload could not carry", () => {
    const msg = nearLimitMessage(4.5 * 1024 * 1024);

    expect(msg).toMatch(/too large/i);
    expect(msg).toContain("4.5 MB");
    expect(msg).toMatch(/compress/i);
  });
});

describe("submitFailureMessage", () => {
  const jsonRes = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  it("prefers the route's own error text", async () => {
    const res = jsonRes({ error: "Word not found." }, 404);
    expect(await submitFailureMessage(res, 1024)).toBe("Word not found.");
  });

  it("names the size when a 413 arrives with a body that is not ours", async () => {
    // Vercel answers an over-cap request with its own HTML. Parsing it throws,
    // and the form used to report that as a network error — the one message
    // that sends someone looking in the wrong place.
    const res = new Response("<html>Request Entity Too Large</html>", { status: 413 });
    const msg = await submitFailureMessage(res, 4.5 * 1024 * 1024);

    expect(msg).toMatch(/too large/i);
    expect(msg).not.toMatch(/network/i);
  });

  it("names the file's own size when it is genuinely over the limit", async () => {
    const res = new Response("<html>Request Entity Too Large</html>", { status: 413 });
    const msg = await submitFailureMessage(res, 9 * 1024 * 1024);

    expect(msg).toContain("9.0 MB");
    expect(msg).toContain("4.5 MB");
  });

  it("falls back to something generic on any other unreadable failure", async () => {
    const res = new Response("<html>Bad Gateway</html>", { status: 502 });
    expect(await submitFailureMessage(res, 1024)).toMatch(/went wrong/i);
  });
});
