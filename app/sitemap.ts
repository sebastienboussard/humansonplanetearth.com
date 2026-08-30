import { MetadataRoute } from "next";
import { getAdminClient } from "@/lib/supabase";
import type { ApprovedPaperRow } from "@/lib/papers";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = getAdminClient();
  const base = "https://humansonplanetearth.com";

  const statics: MetadataRoute.Sitemap = [
    { url: base, priority: 1.0 },
    { url: `${base}/words`, priority: 0.9 },
    { url: `${base}/long-form`, priority: 0.8 },
    { url: `${base}/submit`, priority: 0.7 },
    { url: `${base}/about`, priority: 0.6 },
  ];

  const [{ data: words }, { data: papers }] = await Promise.all([
    admin.from("words").select("word").neq("word", "__long-form__"),
    admin
      .from("papers")
      .select("id, type, submitted_at, words(word)")
      .eq("status", "approved"),
  ]);

  const wordRows = (words ?? []) as { word: string }[];
  const paperRows = (papers ?? []) as ApprovedPaperRow[];

  const wordUrls: MetadataRoute.Sitemap = wordRows.map((w) => ({
    url: `${base}/words/${w.word}`,
    priority: 0.8,
  }));

  // flatMap rather than filter+map: the filter would not narrow `words` away
  // from null for the map that follows, and a word paper whose join came back
  // empty has no URL to give.
  const paperUrls: MetadataRoute.Sitemap = paperRows.flatMap((p) =>
    p.type === "word" && p.words
      ? [
          {
            url: `${base}/words/${p.words.word}/${p.id}`,
            lastModified: new Date(p.submitted_at),
            priority: 0.6,
          },
        ]
      : []
  );

  const longFormUrls: MetadataRoute.Sitemap = paperRows
    .filter((p) => p.type === "long-form")
    .map((p) => ({
      url: `${base}/long-form/${p.id}`,
      lastModified: new Date(p.submitted_at),
      priority: 0.7,
    }));

  return [...statics, ...wordUrls, ...paperUrls, ...longFormUrls];
}
