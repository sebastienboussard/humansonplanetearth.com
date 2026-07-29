# Changelog

All notable changes to this project are documented here.

## 2026-07-28

### Fixed
- **Word and paper pages no longer return 500.** `components/PdfViewer.tsx`
  imports react-pdf at module top level, and pdf.js references `DOMMatrix` — a
  browser-only global — while it evaluates. `"use client"` does not stop Next
  from server-rendering a component for the initial HTML, so every page
  embedding the viewer threw `ReferenceError: DOMMatrix is not defined` in Node
  before its route handler ever ran. The homepage was unaffected, which made the
  site look healthy at a glance. The viewer is now loaded through a client
  wrapper (`components/PdfViewerClient.tsx`) with `dynamic(..., { ssr: false })`,
  so pdf.js only ever evaluates in the browser. Covered by
  `tests/ssr/pdf-viewer-ssr.test.ts`, which evaluates each page module in a Node
  environment and fails with the original error if the static import returns.

## 2026-06-14

### Removed
- Email collection from submissions. The email field served only as a
  duplicate-prevention key and was never displayed, but storing contributor
  emails undercut the site's anonymity promise. Removed from both submit forms,
  both API routes, and the `papers` schema (column + `one_per_email_per_word`
  index dropped). Spam defense is now the admin review queue plus the honeypot.

### Changed
- Submit pages now show a "Privacy: no account, no email" note in place of the
  former email requirement.
- Replaced the iframe PDF viewer with `react-pdf` for native page-flow rendering.

## Earlier

- Set word of the month to "audacity" for June 2026.
- Fixed submit buttons routing to the wrong word and the deadline gate blocking
  the form.
- Removed the "submissions closed" state — submissions are always open.
