import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { stripPdfMetadata } from "@/lib/pdf-sanitize";

// Shared by both submit routes and the change-request route (TODO §24, §6).
describe("stripPdfMetadata", () => {
  it("blanks the Info dictionary and zeroes the dates", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.setTitle("My Paper");
    doc.setAuthor("Jane Realname");
    doc.setSubject("Private");
    doc.setKeywords(["secret"]);
    doc.setCreator("Word");
    doc.setCreationDate(new Date("2026-10-28"));

    const clean = await PDFDocument.load(await stripPdfMetadata(doc), { updateMetadata: false });

    expect(clean.getTitle() ?? "").toBe("");
    expect(clean.getAuthor() ?? "").toBe("");
    expect(clean.getSubject() ?? "").toBe("");
    expect(clean.getKeywords() ?? "").toBe("");
    expect(clean.getCreator() ?? "").toBe("");
    expect(clean.getCreationDate()?.getTime()).toBe(0);
  });

  it("deletes the XMP stream object, not just the catalog reference", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const xmp = doc.context.stream("<x:xmpmeta>Jane Realname</x:xmpmeta>", {
      Type: "Metadata",
      Subtype: "XML",
    });
    doc.catalog.set(PDFName.of("Metadata"), doc.context.register(xmp));

    const bytes = await stripPdfMetadata(doc);

    expect(Buffer.from(bytes).toString("latin1")).not.toContain("Jane Realname");
    const clean = await PDFDocument.load(bytes);
    expect(clean.catalog.get(PDFName.of("Metadata"))).toBeUndefined();
  });
});
