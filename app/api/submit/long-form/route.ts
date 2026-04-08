import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getAdminClient } from "@/lib/supabase";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pdf = formData.get("pdf") as File | null;
    const title = (formData.get("title") as string | null)?.trim();
    const email = (formData.get("email") as string | null)?.trim().toLowerCase();
    const honeypot = formData.get("_trap") as string | null;

    if (honeypot) return NextResponse.json({ ok: true });

    if (!pdf || !title || !email) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (pdf.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
    }

    if (pdf.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be under 10 MB." }, { status: 400 });
    }

    // Validate it's actually a PDF
    const buffer = Buffer.from(await pdf.arrayBuffer());
    try {
      await PDFDocument.load(buffer);
    } catch {
      return NextResponse.json({ error: "Invalid PDF file." }, { status: 400 });
    }

    const admin = getAdminClient();

    // Upload PDF to Supabase Storage
    const filename = `long-form/${Date.now()}.pdf`;
    const { error: uploadErr } = await admin.storage
      .from("papers")
      .upload(filename, buffer, { contentType: "application/pdf", upsert: false });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
    }

    // Insert paper row
    const { error: insertErr } = await admin.from("papers").insert({
      word_id: null,
      type: "long-form",
      title,
      pdf_url: filename,
      email,
      status: "pending",
    });

    if (insertErr) {
      console.error("DB insert error:", insertErr);
      return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Long-form submit error:", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
