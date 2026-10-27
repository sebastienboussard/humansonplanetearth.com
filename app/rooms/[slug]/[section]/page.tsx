import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoom, sectionPages } from "@/lib/room-data";
import RoomPageCard from "../../RoomPageCard";
import PageForm from "../../PageForm";

// One section of a room, addressed by its place from 1. Following a link here
// is the reader choosing to open this part, so its pages render server-side
// (TODO §21). Nothing from any other section is on this page.

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
  const previous = found.sections.find((s) => s.position === position - 1);
  const next = found.sections.find((s) => s.position === position + 1);

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link href={`/rooms/${slug}`} className="text-xs underline underline-offset-4" style={{ ...sans, color: "var(--muted)" }}>
        ← {found.room.title}
      </Link>
      <h1 className="text-3xl font-normal mt-4 mb-8" style={{ color: "var(--forest)" }}>
        {section.label}
      </h1>

      {pages.length === 0 ? (
        <p className="text-sm italic mb-10" style={{ ...sans, color: "var(--muted)" }}>
          Nothing written about this part yet. Be the first.
        </p>
      ) : (
        <div className="mb-12">
          {pages.map((page) => (
            <RoomPageCard key={page.id} page={page} />
          ))}
        </div>
      )}

      <PageForm sectionId={section.id} sectionLabel={section.label} />

      <nav className="flex justify-between mt-12 text-sm" style={sans}>
        {previous ? (
          <Link href={`/rooms/${slug}/${previous.position + 1}`} className="underline underline-offset-4" style={{ color: "var(--muted)" }}>
            ← {previous.label}
          </Link>
        ) : <span />}
        {/* The next part is named, not opened: following it is the reader's choice. */}
        {next && (
          <Link href={`/rooms/${slug}/${next.position + 1}`} className="underline underline-offset-4" style={{ color: "var(--muted)" }}>
            {next.label} →
          </Link>
        )}
      </nav>
    </div>
  );
}
