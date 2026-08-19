/**
 * One-time cleanup: remove storage objects for papers that were rejected
 * before the review route started deleting them (TODO §7).
 *
 * Dry run by default — prints what it would delete and touches nothing.
 * Pass --apply to actually remove the files.
 *
 *   set -a; . ./.env.local; set +a
 *   node scripts/cleanup-rejected-pdfs.mjs
 *   node scripts/cleanup-rejected-pdfs.mjs --apply
 *
 * Plain ESM on purpose: it runs with the node already installed and the
 * @supabase/supabase-js already in node_modules — no tsx, no build step.
 *
 * Rejected rows are kept; only the PDF goes. Nothing on the site renders a
 * rejected paper, so the file has no reader-facing purpose, and while the
 * bucket is public it is downloadable by anyone who guesses the path.
 */
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first:");
  console.error("  set -a; . ./.env.local; set +a");
  process.exit(1);
}

const admin = createClient(url, key);

const { data: rejected, error } = await admin
  .from("papers")
  .select("id, pdf_url")
  .eq("status", "rejected");

if (error) {
  console.error("Could not list rejected papers:", error.message);
  process.exit(1);
}

const paths = (rejected ?? []).map((p) => p.pdf_url).filter(Boolean);

if (paths.length === 0) {
  console.log("No rejected papers with stored files. Nothing to do.");
  process.exit(0);
}

console.log(`${paths.length} rejected paper(s) still have a stored PDF:`);
for (const path of paths) console.log(`  ${path}`);

if (!apply) {
  console.log("\nDry run — nothing deleted. Re-run with --apply to remove these.");
  process.exit(0);
}

// Supabase caps a remove() call at 1000 paths; chunk to stay well under it.
let removed = 0;
for (let i = 0; i < paths.length; i += 100) {
  const chunk = paths.slice(i, i + 100);
  const { error: removeErr } = await admin.storage.from("papers").remove(chunk);
  if (removeErr) {
    console.error(`Failed to remove chunk starting at ${i}:`, removeErr.message);
    continue;
  }
  removed += chunk.length;
}

console.log(`\nRemoved ${removed} of ${paths.length} file(s). Paper rows were left in place.`);
