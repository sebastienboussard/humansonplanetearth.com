import { PDFDocument } from "pdf-lib";

/** Real PDF bytes with the given page count, generated with pdf-lib. */
export async function makePdfBytes(pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

/** A File wrapping a real PDF, suitable for FormData submission tests. */
export async function makePdfFile(
  opts: { pages?: number; name?: string; type?: string } = {}
): Promise<File> {
  const bytes = await makePdfBytes(opts.pages ?? 1);
  return new File([bytes as BlobPart], opts.name ?? "paper.pdf", {
    type: opts.type ?? "application/pdf",
  });
}

/**
 * A file of arbitrary size that only *claims* to be a PDF. Size checks run
 * before parsing, so the content never needs to be valid.
 */
export function makeFileOfSize(bytes: number, type = "application/pdf"): File {
  return new File([new Uint8Array(bytes)], "big.pdf", { type });
}

/** A file with a PDF mime type but garbage content — fails PDF parsing. */
export function makeCorruptPdfFile(): File {
  return new File([new TextEncoder().encode("this is not a pdf")], "corrupt.pdf", {
    type: "application/pdf",
  });
}
