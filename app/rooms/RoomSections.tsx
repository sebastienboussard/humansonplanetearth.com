"use client";

import Link from "next/link";
import { useState } from "react";
import RoomPageCard from "./RoomPageCard";
import type { RoomPageRow, SectionRow } from "@/lib/room-data";

// Every section starts collapsed, and its pages are fetched only when a reader
// opens it (TODO §21). So no page text is in the HTML for anyone to skim past
// a spoiler, and opening a part is a choice the reader makes.

const sans = { fontFamily: "system-ui, sans-serif" } as const;

type Section = SectionRow & { count: number };
type Loaded = { state: "loading" } | { state: "failed" } | { state: "done"; pages: RoomPageRow[] };

export default function RoomSections({ slug, sections }: { slug: string; sections: Section[] }) {
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});

  async function open(id: string) {
    if (loaded[id]) return;
    setLoaded((prev) => ({ ...prev, [id]: { state: "loading" } }));
    try {
      const res = await fetch(`/api/rooms/pages?section=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setLoaded((prev) => ({ ...prev, [id]: { state: "done", pages: data.pages ?? [] } }));
    } catch {
      setLoaded((prev) => ({ ...prev, [id]: { state: "failed" } }));
    }
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const view = loaded[section.id];
        const href = `/rooms/${slug}/${section.position + 1}`;
        return (
          <details
            key={section.id}
            onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open) void open(section.id);
            }}
            className="rounded-sm"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <summary className="px-5 py-4 cursor-pointer flex items-baseline justify-between gap-4">
              <span style={{ color: section.kind === "whole" ? "var(--terracotta)" : "var(--forest)" }}>{section.label}</span>
              <span className="text-xs" style={{ ...sans, color: "var(--muted)" }}>
                {section.count} {section.count === 1 ? "page" : "pages"}
              </span>
            </summary>
            <div className="px-5 pb-5">
              {!view || view.state === "loading" ? (
                <p className="text-sm italic" style={{ ...sans, color: "var(--muted)" }}>Loading…</p>
              ) : view.state === "failed" ? (
                <p className="text-sm italic" style={{ ...sans, color: "var(--muted)" }}>Couldn&rsquo;t load these pages. Close and open again to retry.</p>
              ) : view.pages.length === 0 ? (
                <p className="text-sm italic" style={{ ...sans, color: "var(--muted)" }}>Nothing written here yet.</p>
              ) : (
                view.pages.map((page) => <RoomPageCard key={page.id} page={page} />)
              )}
              <Link href={href} className="inline-block mt-4 text-sm underline underline-offset-4" style={{ ...sans, color: "var(--terracotta)" }}>
                Write a page about {section.kind === "whole" ? "the whole work" : "this part"} →
              </Link>
            </div>
          </details>
        );
      })}
    </div>
  );
}
