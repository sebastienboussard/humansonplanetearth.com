/**
 * Sweep storage objects that no `papers` row references (TODO §7).
 *
 * The mirror image of cleanup-rejected-pdfs.mjs: that script walks database
 * rows and asks storage about each one, so a file with no row is invisible to
 * it by construction. This one walks storage and asks the rows.
 *
 * Where the orphans come from: both submit routes upload the PDF before they
 * insert the row. The routes now undo the upload when the insert fails, but a
 * function that is killed outright — Vercel timeout, cold-start kill — runs no
 * cleanup code at all. Only a sweep from outside can catch those.
 *
 * Dry run by default — prints what it would delete and touches nothing.
 * Pass --apply to actually remove the files.
 *
 *   set -a; . ./.env.local; set +a
 *   node scripts/cleanup-orphaned-pdfs.mjs
 *   node scripts/cleanup-orphaned-pdfs.mjs --apply
 *
 * Plain ESM on purpose: it runs with the node already installed and the
 * @supabase/supabase-js already in node_modules — no tsx, no build step.
 *
 * Nothing younger than GRACE_DAYS is ever a candidate. A file uploaded seconds
 * ago whose row is still being written looks exactly like an orphan, and the
 * grace period is what keeps the sweep safe to run at any moment.
 */
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const GRACE_DAYS = 7;
const PAGE = 1000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first:");
  console.error("  set -a; . ./.env.local; set +a");
  process.exit(1);
}

const admin = createClient(url, key);

/**
 * Every path any row claims, whatever its status. A rejected row keeps its
 * pdf_url after the file is deleted — harmless here, since a path that is in
 * the set simply never becomes a candidate.
 */
async function referencedPaths() {
  const paths = new Set();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("papers")
      .select("pdf_url")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("Could not list papers:", error.message);
      process.exit(1);
    }
    for (const row of data ?? []) if (row.pdf_url) paths.add(row.pdf_url);
    if ((data ?? []).length < PAGE) return paths;
  }
}

/** One page-through of a single storage prefix. */
async function listAll(prefix) {
  const entries = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage
      .from("papers")
      .list(prefix, { limit: PAGE, offset });
    if (error) {
      console.error(`Could not list ${prefix || "<root>"}:`, error.message);
      process.exit(1);
    }
    entries.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return entries;
  }
}

/**
 * Paths are `<word_id>/<uuid>.pdf` and `long-form/<uuid>.pdf`, so storage is
 * two levels deep. `list` is not recursive: the root returns folder
 * pseudo-entries, which come back with a null id and no created_at.
 */
async function storedFiles() {
  const files = [];
  for (const entry of await listAll("")) {
    if (entry.id !== null) continue; // a file at the root — not a path we write
    for (const file of await listAll(entry.name)) {
      if (file.id === null) continue;
      // Only ever consider files we wrote. Supabase leaves a
      // `.emptyFolderPlaceholder` object behind in every folder, and it has no
      // paper row by definition — without this it would be reported as an
      // orphan and deleted on the first --apply run.
      if (!file.name.endsWith(".pdf")) continue;
      files.push({ path: `${entry.name}/${file.name}`, createdAt: file.created_at });
    }
  }
  return files;
}

const referenced = await referencedPaths();
const files = await storedFiles();

const cutoff = Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000;
const unreferenced = files.filter((f) => !referenced.has(f.path));
const orphans = unreferenced.filter((f) => new Date(f.createdAt).getTime() < cutoff);
const tooYoung = unreferenced.length - orphans.length;

console.log(`${files.length} stored file(s), ${referenced.size} referenced by a paper row.`);

if (tooYoung > 0) {
  console.log(`${tooYoung} unreferenced file(s) newer than ${GRACE_DAYS} days — leaving alone.`);
}

if (orphans.length === 0) {
  console.log("No orphaned files.");
  process.exit(0);
}

const ageInDays = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

console.log(`\n${orphans.length} stored file(s) with no papers row:`);
for (const f of orphans) console.log(`  ${f.path}   (age ${ageInDays(f.createdAt)}d)`);

if (!apply) {
  console.log("\nDry run — nothing deleted. Re-run with --apply to remove these.");
  process.exit(0);
}

// Supabase caps a remove() call at 1000 paths; chunk to stay well under it.
const paths = orphans.map((f) => f.path);
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

console.log(`\nRemoved ${removed} of ${paths.length} file(s).`);
