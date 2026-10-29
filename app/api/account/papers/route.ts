import { NextResponse } from "next/server";
import { getSessionUser, ensureProfile } from "@/lib/profile";
import { getAdminClient } from "@/lib/supabase";

type ChangeRow = {
  paper_id: string;
  status: "pending" | "applied" | "declined";
  created_at: string;
  decided_at: string | null;
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const profile = await ensureProfile(user);
  if (!profile) {
    return NextResponse.json({ error: "Profile unavailable. Please try again." }, { status: 500 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("paper_authors")
    .select("paper_id, papers(id, title, type, status, word_id, submitted_at)")
    .eq("profile_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { paper_id: string }[];

  // Each paper's latest change request (TODO §24), so the author can see
  // whether theirs is waiting, applied or declined. Only papers already proven
  // to be this profile's are asked about. A failure here costs the status
  // line, not the list.
  const latest = new Map<string, ChangeRow>();
  if (rows.length > 0) {
    const { data: changes, error: changeErr } = await admin
      .from("paper_edit_requests")
      .select("paper_id, status, created_at, decided_at")
      .in("paper_id", rows.map((r) => r.paper_id))
      .order("created_at", { ascending: false });
    if (changeErr) console.error("Change request lookup error:", changeErr);
    for (const c of (changes ?? []) as ChangeRow[]) {
      if (!latest.has(c.paper_id)) latest.set(c.paper_id, c);
    }
  }

  const papers = rows.map((r) => {
    const c = latest.get(r.paper_id);
    return {
      ...r,
      change: c ? { status: c.status, at: c.decided_at ?? c.created_at } : null,
    };
  });

  return NextResponse.json({ papers });
}
