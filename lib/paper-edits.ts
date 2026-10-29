// Change requests on papers (TODO §24), the admin side's shared bookkeeping.
// A request's replacement PDF is referenced by nothing but the request until
// it is applied, so whenever a paper leaves for good — rejected or deleted —
// its open request has to be closed and its file removed with it.

import { getAdminClient } from "@/lib/supabase";
import { removeStoredPdf } from "@/lib/storage-cleanup";

/**
 * Replacement files of the paper's pending requests. Best-effort: a failed
 * lookup returns nothing, and any file left behind is swept later by
 * `scripts/cleanup-orphaned-pdfs.mjs`, which only protects pending requests.
 */
export async function pendingEditPaths(paperId: string): Promise<string[]> {
  try {
    const { data, error } = await getAdminClient()
      .from("paper_edit_requests")
      .select("pdf_path")
      .eq("paper_id", paperId)
      .eq("status", "pending");
    if (error) {
      console.error("Pending change lookup failed:", paperId, error.message);
      return [];
    }
    return ((data ?? []) as { pdf_path: string }[]).map((r) => r.pdf_path);
  } catch (err) {
    console.error("Pending change lookup failed:", paperId, err);
    return [];
  }
}

/**
 * Close the paper's open request as declined and remove its file. Called once
 * the paper itself has been rejected. Never throws: the rejection has already
 * happened and must not be reported as a failure.
 */
export async function declinePendingEdits(paperId: string) {
  const paths = await pendingEditPaths(paperId);
  if (paths.length === 0) return;
  try {
    const { error } = await getAdminClient()
      .from("paper_edit_requests")
      .update({ status: "declined", decided_at: new Date().toISOString() })
      .eq("paper_id", paperId)
      .eq("status", "pending");
    if (error) {
      // Leave the file: the request still claims it.
      console.error("Closing change request failed:", paperId, error.message);
      return;
    }
  } catch (err) {
    console.error("Closing change request failed:", paperId, err);
    return;
  }
  for (const path of paths) await removeStoredPdf(path);
}
