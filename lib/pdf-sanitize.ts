// Metadata stripping for every PDF that enters the `papers` bucket (anonymity).
// One copy, shared by the two submit routes and the change-request route
// (TODO §24), so the three cannot drift apart. The known gaps are TODO §6.

import { PDFDocument, PDFName, PDFRef } from "pdf-lib";

/**
 * Blank the Info dictionary, zero the dates, delete the XMP stream, and
 * return the re-saved bytes. Throws if pdf-lib cannot do it — the caller must
 * then refuse the upload, never fall back to the original un-stripped bytes.
 */
export async function stripPdfMetadata(pdfDoc: PDFDocument): Promise<Buffer> {
  pdfDoc.setTitle("");
  pdfDoc.setAuthor("");
  pdfDoc.setSubject("");
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer("");
  pdfDoc.setCreator("");
  pdfDoc.setCreationDate(new Date(0));
  pdfDoc.setModificationDate(new Date(0));

  // Remove the XMP metadata stream — delete the object itself, not just the
  // catalog reference (pdf-lib doesn't garbage-collect orphaned objects).
  const metaRef = pdfDoc.catalog.get(PDFName.of("Metadata"));
  pdfDoc.catalog.delete(PDFName.of("Metadata"));
  if (metaRef instanceof PDFRef) pdfDoc.context.delete(metaRef);

  const cleanBytes = await pdfDoc.save({ updateFieldAppearances: false });
  return Buffer.from(cleanBytes);
}
