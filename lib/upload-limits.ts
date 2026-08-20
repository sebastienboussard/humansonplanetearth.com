/**
 * Upload size limits, in one place.
 *
 * These were previously written out separately in each route and each form,
 * with a comment asking the next person to keep them in step. They are shared
 * now so that cannot drift.
 *
 * One limit for both routes: a word paper and a long-form paper get the same
 * 4.5 MB. That is the ceiling, not a comfortable middle — Vercel refuses a
 * serverless request body above roughly 4.5 MB before our handler runs at all,
 * and multipart framing adds a few hundred bytes on top of the file itself. So
 * a PDF sitting right at the limit can still be refused at the platform edge,
 * with a response that is not ours. `submitFailureMessage` below exists for
 * exactly that case: whoever hits it gets a size message rather than silence.
 */

/** The largest PDF either submit route accepts. */
export const MAX_UPLOAD_SIZE = 4.5 * 1024 * 1024; // 4.5 MB

/**
 * Kept as named aliases because the two routes read better naming their own
 * limit, and because a future limit split has one obvious place to happen.
 */
export const WORD_MAX_SIZE = MAX_UPLOAD_SIZE;
export const LONG_FORM_MAX_SIZE = MAX_UPLOAD_SIZE;

/** "6.4 MB", "812 KB" — one decimal for MB, none for KB. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * The message shown when a chosen file is too large.
 *
 * It names the file's actual size, not just the cap. "File must be under 4.5 MB"
 * leaves someone holding a 4.6 MB PDF unsure whether they are marginally or
 * wildly over, and gives them nothing to act on.
 */
export function oversizeMessage(actualBytes: number, maxBytes: number): string {
  return `That file is ${formatBytes(actualBytes)} — the limit is ${formatBytes(
    maxBytes
  )}. Try exporting the PDF at a lower image quality, or compressing it, and upload again.`;
}

/**
 * For a file our own limit accepts but the upload still could not carry: right
 * at 4.5 MB, the request body — file plus multipart framing — tips over the
 * platform's cap and is refused before the route sees it. The size is the
 * cause, so the message has to say so instead of blaming the connection.
 */
export function nearLimitMessage(actualBytes: number): string {
  return `That upload was refused as too large. At ${formatBytes(
    actualBytes
  )} the file is right at the ${formatBytes(
    MAX_UPLOAD_SIZE
  )} limit, and the upload itself adds a little on top. Compress the PDF a bit further and try again.`;
}

/**
 * Turn a failed submit response into something worth reading.
 *
 * A 413 from the platform edge never reaches our handler, so its body is the
 * platform's own HTML rather than our JSON. Parsing that throws, and the forms
 * used to report the throw as "Network error" — sending someone to check their
 * wifi over a file that was simply too big.
 */
export async function submitFailureMessage(res: Response, fileBytes: number): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.error === "string") return data.error;
  } catch {
    // Not our JSON — fall through to what the status alone can tell us.
  }

  if (res.status === 413) {
    return fileBytes > MAX_UPLOAD_SIZE
      ? oversizeMessage(fileBytes, MAX_UPLOAD_SIZE)
      : nearLimitMessage(fileBytes);
  }

  return "Something went wrong. Please try again.";
}
