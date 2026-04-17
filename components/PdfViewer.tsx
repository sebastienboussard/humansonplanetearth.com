"use client";

import { useState } from "react";

export default function PdfViewer({
  src,
  title,
  height = "80vh",
  paperNumber,
  paperHref,
}: {
  src: string;
  title: string;
  height?: string;
  paperNumber?: number;
  paperHref?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const iframeSrc = `${src}#toolbar=1&view=FitH&zoom=page-width`;

  return (
    <div className="w-full">
      {(paperNumber !== undefined || paperHref) && (
        <div
          className="flex items-center justify-between mb-2 flex-wrap gap-2"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {paperNumber !== undefined && (
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              Paper {paperNumber}
            </span>
          )}
          <div className="flex items-center gap-4 ml-auto">
            <a
              href={src}
              download
              className="text-sm underline underline-offset-4"
              style={{ color: "var(--muted)" }}
            >
              Download
            </a>
            {paperHref && (
              <a
                href={paperHref}
                className="text-sm underline underline-offset-4"
                style={{ color: "var(--terracotta)" }}
              >
                Full page →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Mobile: plain link */}
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="flex md:hidden items-center justify-center rounded-sm text-sm underline underline-offset-4"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--terracotta)",
          fontFamily: "system-ui, sans-serif",
          height,
        }}
      >
        View PDF →
      </a>

      {/* Desktop: iframe */}
      {error ? (
        <div
          className="hidden md:flex items-center justify-center rounded-sm"
          style={{ height, backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
            Unable to load paper. Please try refreshing.
          </p>
        </div>
      ) : (
        <div className="relative w-full rounded-sm hidden md:block" style={{ height }}>
          {!loaded && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-sm"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <p
                className="text-sm italic"
                style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}
              >
                Loading…
              </p>
            </div>
          )}
          <iframe
            src={iframeSrc}
            title={title}
            className="w-full h-full rounded-sm"
            style={{ border: "1px solid var(--border)", display: loaded ? "block" : "none" }}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        </div>
      )}
    </div>
  );
}
