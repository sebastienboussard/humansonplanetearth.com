import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoom, marginCounts, pageHandle, sectionHref, sectionPages } from "@/lib/room-data";
import RoomPageCard, { pageAnchor } from "../../RoomPageCard";
import PageForm from "../../PageForm";

// One section of a room, addressed by its place from 1. Following a link here
// is the reader choosing to open this part, so its pages render server-side
// (TODO §21). Nothing from any other section is on this page.
//
// This is the one place a part is read. With more than one page it opens with
// a numbered list of them, each line telling the page apart (pageHandle), and
// every card links on to the next.

export const revalidate = 60;

const sans = { fontFamily: "system-ui, sans-serif" } as const;

export default async function SectionPage({ params }: { params: Promise<{ slug: string; section: string }> }) {
  const { slug, section: place } = await params;
  const position = Number(place) - 1;
  const found = await getRoom(slug);
  if (!found || !Number.isInteger(position)) notFound();
  const section = found.sections.find((s) => s.position === position);
  if (!section) notFound();
  const pages = await sectionPages(section.id);
  const margins = await marginCounts(pages.map((p) => p.id));
  const marginTotal = pages.reduce((sum, p) => sum + (margins[p.id] ?? 0), 0);
  const listed = pages.length > 1;
  const previous = found.sections.find((s) => s.position === position - 1);
  const next = found.sections.find((s) => s.position === position + 1);

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link href={`/rooms/${slug}`} className="text-xs underline underline-offset-4" style={{ ...sans, color: "var(--muted)" }}>
        ← {found.room.title}
      </Link>
      <h1 className="text-3xl font-normal mt-4 mb-2" style={{ color: "var(--forest)" }}>
        {section.label}
      </h1>
      <p className="text-xs mb-8 flex flex-wrap gap-x-4" style={{ ...sans, color: "var(--muted)" }}>
        {pages.length > 0 && (
          <span>
            {pages.length} {pages.length === 1 ? "page" : "pages"} · {marginTotal} {marginTotal === 1 ? "comment" : "comments"}
          </span>
        )}
        <a href="#write" className="underline underline-offset-4" style={{ color: "var(--terracotta)" }}>
          Write a page ↓
        </a>
      </p>

      {pages.length === 0 ? (
        <p className="text-sm italic mb-10" style={{ ...sans, color: "var(--muted)" }}>
          Nothing written about this part yet. Be the first.
        </p>
      ) : (
        <>
          {listed && (
            <nav id="pages" aria-label="Pages in this part" className="mb-10 scroll-mt-6">
              <ol className="text-sm" style={sans}>
                {pages.map((page, i) => {
                  const count = margins[page.id] ?? 0;
                  return (
                    <li key={page.id} style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
                      <a href={`#${pageAnchor(i + 1)}`} className="flex items-baseline gap-3 py-2 hover:opacity-80">
                        <span className="w-6 shrink-0 text-xs" style={{ color: "var(--muted)" }}>{i + 1}</span>
                        <span className="flex-1 min-w-0 truncate" style={{ color: "var(--forest)" }}>{pageHandle(page)}</span>
                        <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                          {new Date(page.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {count > 0 && ` · ${count} ${count === 1 ? "comment" : "comments"}`}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}
          <div className="space-y-6 mb-12">
            {pages.map((page, i) => (
              <RoomPageCard
                key={page.id}
                page={page}
                n={i + 1}
                total={pages.length}
                marginCount={margins[page.id] ?? 0}
                listed={listed}
              />
            ))}
          </div>
        </>
      )}

      <div id="write" className="scroll-mt-6">
        <PageForm sectionId={section.id} sectionLabel={section.label} roomHref={`/rooms/${slug}`} roomTitle={found.room.title} />
      </div>

      <nav className="flex justify-between gap-4 mt-12 text-sm" style={sans}>
        {previous ? (
          <Link href={sectionHref(slug, previous)} className="underline underline-offset-4" style={{ color: "var(--muted)" }}>
            ← {previous.label}
          </Link>
        ) : <span />}
        {/* The next part is named, not opened: following it is the reader's choice. */}
        {next && (
          <Link href={sectionHref(slug, next)} className="underline underline-offset-4 text-right" style={{ color: "var(--muted)" }}>
            {next.label} →
          </Link>
        )}
      </nav>
    </div>
  );
}
