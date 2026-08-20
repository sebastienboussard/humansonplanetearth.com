import { MAX_UPLOAD_SIZE, formatBytes } from "@/lib/upload-limits";

/**
 * The terms footer under both submit forms.
 *
 * These lines used to be copy-pasted into app/submit/page.tsx and
 * app/submit/[word]/page.tsx. They drifted: both still advertised a 2 MB cap
 * long after the real limit moved to 4.5 MB. Shared here, and reading the size
 * from lib/upload-limits rather than spelling it out, so it cannot drift again.
 */
export default function SubmitTerms() {
  return (
    <div
      className="mt-12 pt-8 space-y-2 text-sm"
      style={{ borderTop: "1px solid var(--border)", fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
    >
      <p><strong style={{ color: "var(--ink)" }}>Form:</strong> Written, drawn, or anything else — if it fits on one page as a PDF, it belongs.</p>
      <p><strong style={{ color: "var(--ink)" }}>Format:</strong> PDF only · 1 page max · {formatBytes(MAX_UPLOAD_SIZE)} max</p>
      <p><strong style={{ color: "var(--ink)" }}>Privacy:</strong> No account required — you can submit with zero identifying information. If you sign in, you may optionally attach your paper to your anonymous profile (private by default).</p>
      <p><strong style={{ color: "var(--ink)" }}>Authorship:</strong> All papers credited as <em>Human On Planet Earth</em>.</p>
      <p><strong style={{ color: "var(--ink)" }}>Moderation:</strong> Reviewed before publishing. Everything welcome except spam and hate.</p>
    </div>
  );
}
