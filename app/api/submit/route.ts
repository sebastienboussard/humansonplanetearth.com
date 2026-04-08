import { NextRequest, NextResponse } from "next/server";

// TODO: connect Supabase after setup
// This route will:
//  1. Parse the multipart form (pdf + email + word)
//  2. Validate PDF (MIME type, size, page count via pdf-parse)
//  3. Enforce one-per-email-per-word via Supabase unique constraint
//  4. Store PDF in Supabase Storage
//  5. Insert row into `papers` table with status: 'pending'

export async function POST(req: NextRequest) {
  // Supabase not yet configured — return a clear error
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json(
      { error: "Submissions not yet available. Check back soon." },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const pdf = formData.get("pdf") as File | null;
    const email = formData.get("email") as string | null;
    const word = formData.get("word") as string | null;

    if (!pdf || !email || !word) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (pdf.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
    }

    if (pdf.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 2 MB." }, { status: 400 });
    }

    // TODO: page count check with pdf-parse
    // TODO: Supabase storage upload
    // TODO: Supabase papers insert

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
