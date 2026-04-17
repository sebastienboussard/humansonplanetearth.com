"use client";

import { useState } from "react";

export default function PdfViewer({
  src,
  title,
  height = "80vh",
}: {
  src: string;
  title: string;
  height?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className="py-32 text-center rounded-sm"
        style={{ height, backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          Unable to load paper. Please try refreshing.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-sm" style={{ height }}>
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-sm"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm italic" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
            Loading…
          </p>
        </div>
      )}
      <iframe
        src={src}
        title={title}
        className="w-full h-full rounded-sm"
        style={{ border: "1px solid var(--border)", display: loaded ? "block" : "none" }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
