/**
 * Upload size limits, in one place.
 *
 * These were previously written out separately in each route and each form,
 * with a comment asking the next person to keep them in step. They are shared
 * now so that cannot drift.
 *
 * The long-form limit is 4 MB rather than something rounder because Vercel
 * refuses a serverless request body above roughly 4.5 MB before our handler
 * runs at all — a higher limit would be one we could not enforce or explain.
 */

export const WORD_MAX_SIZE = 2 * 1024 * 1024; // 2 MB
export const LONG_FORM_MAX_SIZE = 4 * 1024 * 1024; // 4 MB

/** "6.4 MB", "812 KB" — one decimal for MB, none for KB. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * The message shown when a chosen file is too large.
 *
 * It names the file's actual size, not just the cap. "File must be under 4 MB"
 * leaves someone holding a 4.1 MB PDF unsure whether they are marginally or
 * wildly over, and gives them nothing to act on.
 */
export function oversizeMessage(actualBytes: number, maxBytes: number): string {
  return `That file is ${formatBytes(actualBytes)} — the limit is ${formatBytes(
    maxBytes
  )}. Try exporting the PDF at a lower image quality, or compressing it, and upload again.`;
}
