# Doubt Log

## 2026-07-22 — main (fix in progress, no dedicated commit yet)
- What I reviewed: Two passes over the PDF-metadata-stripping plan
  (`.claude/plans/i-dont-understand-this-foamy-pinwheel.md`) and the two upload
  routes it changes (`app/api/submit/route.ts`,
  `app/api/submit/long-form/route.ts`). Goal: strip identifying metadata from
  anonymous PDF submissions before storage.
- Strongest counter-argument:
  - Pass 1: pdf-lib's `setAuthor`/`setTitle`/etc. clear only the Info
    dictionary — the XMP metadata stream (`/Metadata` on the catalog, where
    Word/LaTeX/Acrobat put `dc:creator`) survives untouched, so a real author
    name would still leak. The original verification (pdf-lib `getAuthor()`
    check, Info-dict-only test PDF) was structurally incapable of catching
    this.
  - Pass 2 (revised plan): `catalog.delete(PDFName.of("Metadata"))` removes
    only the *reference*. pdf-lib does not garbage-collect on `save()` — it
    writes every object in the context — so the XMP stream likely persists as
    an orphaned object with the name still in the raw bytes. Worse, `exiftool`
    follows the reference and reports "clean," making verification a false
    PASS. Fix: also `pdfDoc.context.delete(metaRef)` and verify with a raw
    byte scan (`strings downloaded.pdf | grep -i "SECRET NAME"`), not exiftool
    alone.
- Open questions:
  - Visible byline in the document body/header is the most common
    deanonymization vector and no metadata scrub touches it — human review (or
    explicit submitter warning) still required before publishing.
  - Custom (non-standard) Info-dictionary keys and Word custom document
    properties are not cleared by the six standard setters — residual leak.
  - Page-level and image-XObject `/Metadata` (XMP) plus EXIF inside embedded
    images survive the re-save; annotation `/T` author tags too.
  - `save()` default `updateFieldAppearances: true` can silently alter form
    rendering — recommend `false`; post-save size can exceed the pre-check
    limit (re-check added in revised plan).
  - Plan justifies avoiding exiftool/qpdf by claiming a hosting constraint —
    unverified; conclusion holds either way but the rationale should be
    checked.
