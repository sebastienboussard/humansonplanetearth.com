import { MetadataRoute } from "next";
import { getAdminClient } from "@/lib/supabase";

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

  const wordUrls: MetadataRoute.Sitemap = (words ?? []).map((w: any) => ({
    url: `${base}/words/${w.word}`,
    priority: 0.8,
  }));

  const paperUrls: MetadataRoute.Sitemap = (papers ?? [])
    .filter((p: any) => p.type === "word" && p.words?.word)
    .map((p: any) => ({
      url: `${base}/words/${p.words.word}/${p.id}`,
      lastModified: new Date(p.submitted_at),
      priority: 0.6,
    }));

  const longFormUrls: MetadataRoute.Sitemap = (papers ?? [])
    .filter((p: any) => p.type === "long-form")
    .map((p: any) => ({
      url: `${base}/long-form/${p.id}`,
      lastModified: new Date(p.submitted_at),
      priority: 0.7,
    }));

  return [...statics, ...wordUrls, ...paperUrls, ...longFormUrls];
}
