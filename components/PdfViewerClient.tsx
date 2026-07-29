"use client";

import dynamic from "next/dynamic";
import type { PdfViewerProps } from "./PdfViewer";

// react-pdf evaluates pdf.js at module scope, and pdf.js references DOMMatrix —
// a browser-only global. "use client" does not stop Next from server-rendering a
// component for the initial HTML, so importing PdfViewer directly makes every
// page that embeds it throw `ReferenceError: DOMMatrix is not defined` in Node.
//
// Deferring the import to the browser is the fix. `ssr: false` is only legal
// inside a client component, which is why this wrapper exists: the paper pages
// are server components and cannot call dynamic() this way themselves.
const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    // A4-ish placeholder so the page doesn't jump when the viewer mounts.
    <div
      className="w-full rounded-sm animate-pulse"
      style={{
        height: 800,
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    />
  ),
});

export default function PdfViewerClient(props: PdfViewerProps) {
  return <PdfViewer {...props} />;
}
