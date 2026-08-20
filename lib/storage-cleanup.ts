/**
 * Storage-side cleanup for the `papers` bucket.
 *
 * Two callers with opposite hazards:
 *   - the review route, where the row has already changed and the file should
 *     follow (`removeStoredPdf`)
 *   - the submit routes, where the file landed but the row may not have
 *     (`discardOrphanedUpload`)
 */
import { getAdminClient } from "@/lib/supabase";

/**
 * Best-effort storage removal. The file may already be gone, and neither
 * deleting nor rejecting a paper should fail because the bucket did — the
 * database is the record of truth about what is published.
 */
export async function removeStoredPdf(path: string) {
  try {
    const { error } = await getAdminClient().storage.from("papers").remove([path]);
    if (error) console.error("Storage removal failed:", path, error.message);
  } catch (err) {
    console.error("Storage removal failed:", path, err);
  }
}

/**
 * Undo an upload whose `papers` insert did not land.
 *
 * The upload commits before the row is written, so a failed or timed-out
 * insert leaves a file nothing references. But a timed-out insert may have
 * *committed* — only the reply was lost — and deleting the file then would
 * strand a live row pointing at missing storage, which is the worse failure.
 *
 * So: ask first. Delete only when the database is certain no row claims the
 * path. Anything else — a row found, or a lookup that itself failed — leaves
 * the file for `scripts/cleanup-orphaned-pdfs.mjs` to sweep later.
 *
 * Never throws: cleanup must not change what the caller returns.
 */
export async function discardOrphanedUpload(path: string) {
  try {
    const { data, error } = await getAdminClient()
      .from("papers")
      .select("id")
      .eq("pdf_url", path)
      .limit(1);

    if (error) {
      console.error("Orphan check failed, leaving file in place:", path, error.message);
      return;
    }

    if (data && data.length > 0) {
      console.error("Insert reported failure but the row exists, keeping file:", path);
      return;
    }

    await removeStoredPdf(path);
  } catch (err) {
    console.error("Orphan check failed, leaving file in place:", path, err);
  }
}
