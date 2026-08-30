import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import type { ApprovedPaperRow } from "@/lib/papers";

export const revalidate = 3600;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const admin = getAdminClient();
  const base = "https://humansonplanetearth.com";

  const [{ data: wordPapers }, { data: longFormPapers }] = await Promise.all([
    admin
      .from("papers")
      .select("id, submitted_at, words(word)")
      .eq("type", "word")
      .eq("status", "approved")
      .order("submitted_at", { ascending: false })
      .limit(20),
    admin
      .from("papers")
      .select("id, title, submitted_at")
      .eq("type", "long-form")
      .eq("status", "approved")
      .order("submitted_at", { ascending: false })
      .limit(20),
  ]);

  // Neither select includes `type` — each query already filters on it — so the
  // word rows are the shared shape minus that column.
  const wordRows = (wordPapers ?? []) as Omit<ApprovedPaperRow, "type">[];
  const longFormRows = (longFormPapers ?? []) as {
    id: string;
    title: string | null;
    submitted_at: string;
  }[];

  const items = [
    // flatMap rather than filter+map: a filter on `p.words` does not narrow it
    // away from null for the map that follows.
    ...wordRows.flatMap((p) =>
      p.words
        ? [
            {
              title: `A paper on "${p.words.word}"`,
              link: `${base}/words/${p.words.word}/${p.id}`,
              pubDate: new Date(p.submitted_at).toUTCString(),
              description: `A one-page paper on the word "${p.words.word}", submitted by a human on planet Earth.`,
            },
          ]
        : []
    ),
    ...longFormRows.map((p) => ({
      title: p.title ?? "Long-Form Paper",
      link: `${base}/long-form/${p.id}`,
      pubDate: new Date(p.submitted_at).toUTCString(),
      description: `A long-form paper titled "${escapeXml(p.title ?? "untitled")}", submitted by a human on planet Earth.`,
    })),
  ]
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 30);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Humans on Planet Earth</title>
    <link>${base}</link>
    <description>A word is chosen each month. Anyone can respond in one page — written, drawn, or anything else.</description>
    <language>en</language>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml" />
${items.map((item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <guid>${item.link}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`).join("\n")}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
