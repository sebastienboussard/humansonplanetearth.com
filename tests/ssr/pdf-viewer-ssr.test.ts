import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Regression guard for the outage where every page embedding the PDF viewer
 * returned 500 in production.
 *
 * `components/PdfViewer.tsx` imports react-pdf, which evaluates pdf.js at module
 * scope; pdf.js references `DOMMatrix`, a browser-only global. `"use client"`
 * does not stop Next from server-rendering a component for the initial HTML, so
 * a static import chain from a page to PdfViewer throws
 * `ReferenceError: DOMMatrix is not defined` in Node — before the route handler
 * ever runs. The homepage was unaffected, so the site looked healthy.
 *
 * These tests run in the `node` environment (see vitest.config.ts), which is
 * exactly the context that lacks DOMMatrix.
 */

const ROOT = path.resolve(__dirname, "../..");

describe("PDF viewer is never in a server-rendered import chain", () => {
  // The behavioural test: evaluating each page module in Node must not throw.
  // This is the precise failure mode — the crash happened at module evaluation.
  const pages = [
    "@/app/words/[word]/page",
    "@/app/words/[word]/[paperId]/page",
    "@/app/long-form/[paperId]/page",
    "@/app/long-form/page",
  ];

  for (const page of pages) {
    it(`evaluates ${page} in Node without touching browser globals`, async () => {
      expect(typeof (globalThis as Record<string, unknown>).DOMMatrix).toBe("undefined");
      const mod = await import(/* @vite-ignore */ page);
      expect(mod.default).toBeTypeOf("function");
    });
  }

  // The structural invariant: only the client wrapper may import PdfViewer
  // directly. Cheap, and it catches a regression at the import site rather than
  // waiting for a page to be added to the list above.
  it("routes PdfViewer imports through the ssr:false wrapper only", () => {
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;

        const rel = path.relative(ROOT, full);
        // The wrapper is the one place allowed to reference the real module.
        if (rel === path.join("components", "PdfViewerClient.tsx")) continue;
        if (rel === path.join("components", "PdfViewer.tsx")) continue;

        const src = readFileSync(full, "utf8");
        if (/from\s+["'](?:@\/components|\.|\.\.)\/PdfViewer["']/.test(src)) {
          offenders.push(rel);
        }
      }
    };

    walk(path.join(ROOT, "app"));
    walk(path.join(ROOT, "components"));

    expect(offenders).toEqual([]);
  });

  it("loads PdfViewer with ssr disabled", () => {
    const wrapper = readFileSync(
      path.join(ROOT, "components", "PdfViewerClient.tsx"),
      "utf8"
    );
    expect(wrapper).toMatch(/^"use client";/);
    expect(wrapper).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\(["']\.\/PdfViewer["']\)/);
    expect(wrapper).toMatch(/ssr:\s*false/);
  });
});
