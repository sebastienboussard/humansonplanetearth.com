"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function PdfViewer({
  src,
  title,
  paperNumber,
  paperHref,
}: {
  src: string;
  title: string;
  height?: string; // kept for backwards compat, unused
  paperNumber?: number;
  paperHref?: string;
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const onLoadError = useCallback(() => {
    setError(true);
  }, []);

  // A4 aspect ratio skeleton height while width is being measured
  const skeletonHeight = containerWidth ? Math.round(containerWidth * 1.414) : 800;

  return (
    <div className="w-full" style={{ fontFamily: "system-ui, sans-serif" }}>
      {(paperNumber !== undefined || paperHref) && (
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
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

      <div ref={containerRef} className="w-full">
        {error ? (
          <div
            className="flex items-center justify-center rounded-sm"
            style={{
              height: 400,
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Unable to load paper. Please try refreshing.
            </p>
          </div>
        ) : (
          <Document
            file={src}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            loading={
              <div
                className="rounded-sm animate-pulse"
                style={{
                  height: skeletonHeight,
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              />
            }
          >
            {numPages !== null &&
              containerWidth > 0 &&
              Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={i + 1}
                  pageNumber={i + 1}
                  width={containerWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="mb-2 last:mb-0"
                />
              ))}
          </Document>
        )}
      </div>
    </div>
  );
}
