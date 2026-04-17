import Link from "next/link";
import { getAdminClient } from "@/lib/supabase";

export const revalidate = 60;

export const metadata = {
  title: "Long-Form — Humans on Planet Earth",
};

export default async function LongFormPage() {
  const admin = getAdminClient();

  const { data: papers } = await admin
    .from("papers")
    .select("id, title, submitted_at")
    .eq("type", "long-form")
    .eq("status", "approved")
    .order("submitted_at", { ascending: false });

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-4">
        <h1 className="text-4xl font-normal" style={{ color: "var(--forest)" }}>
          Long-Form
        </h1>
        <Link
          href="/long-form/submit"
          className="text-sm underline underline-offset-4"
          style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
        >
          Submit a paper →
        </Link>
      </div>
      <p
        className="text-sm mb-12"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        Writing of any length, any topic, any time. No monthly word required.
      </p>

      {!papers || papers.length === 0 ? (
        <div className="py-16 text-center" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          <p className="text-base mb-1">No papers yet.</p>
          <p className="text-sm italic">
            Be the first.{" "}
            <Link href="/long-form/submit" style={{ color: "var(--terracotta)" }} className="underline underline-offset-4">
              Submit one →
            </Link>
          </p>
        </div>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {papers.map((paper: any) => (
            <li key={paper.id}>
              <Link
                href={`/long-form/${paper.id}`}
                className="flex items-baseline justify-between py-5 group gap-4"
              >
                <span
                  className="text-xl font-normal group-hover:underline underline-offset-4"
                  style={{ color: "var(--forest)" }}
                >
                  {paper.title}
                </span>
                <span
                  className="text-sm shrink-0"
                  style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
                >
                  {new Date(paper.submitted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
