"use client";

import { useSyncExternalStore } from "react";
import { AdminDataProvider, useAdminData } from "./AdminData";
import MessagesInbox from "./MessagesInbox";
import ReviewQueue from "./ReviewQueue";
import PublishedPapers from "./PublishedPapers";
import WordsPanel from "./WordsPanel";

const TABS = [
  { id: "messages", label: "Messages" },
  { id: "pending", label: "Pending papers" },
  { id: "published", label: "Published papers" },
  { id: "words", label: "Words" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}

// The hash (#pending) keeps the active tab across reloads and gives the admin
// alert emails something to deep-link to. Deliberately not useSearchParams —
// that would force a Suspense boundary for no gain on a private page. The hash
// is read through useSyncExternalStore so the server render and the first
// client render agree ("messages") and the real tab appears on hydration.
function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function tabFromHash(): TabId {
  const hash = window.location.hash.replace(/^#/, "");
  return isTabId(hash) ? hash : "messages";
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs text-white"
      style={{ backgroundColor: "var(--terracotta)" }}
    >
      {count}
    </span>
  );
}

function Tabs() {
  const { pending, unread, error, dismissError } = useAdminData();
  const active = useSyncExternalStore(subscribeToHash, tabFromHash, () => "messages");

  function select(tab: TabId) {
    // replaceState avoids polluting history, but fires no hashchange — nudge
    // the store by hand so the subscribed snapshot re-reads.
    history.replaceState(null, "", `#${tab}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  const badges: Partial<Record<TabId, number>> = {
    messages: unread,
    pending: pending.length,
  };

  return (
    <div>
      {error && (
        <div
          className="flex items-center justify-between gap-4 px-5 py-3 mb-6 rounded-sm text-sm"
          style={{
            border: "1px solid var(--terracotta)",
            color: "var(--terracotta)",
            fontFamily: "system-ui, sans-serif",
          }}
          role="alert"
        >
          <span>{error}</span>
          <button onClick={dismissError} aria-label="Dismiss" className="shrink-0">
            ✕
          </button>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Admin sections"
        className="flex rounded-sm overflow-hidden mb-10 flex-wrap"
        style={{ border: "1px solid var(--border)", fontFamily: "system-ui, sans-serif" }}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => select(tab.id)}
              className="flex-1 text-sm px-4 py-2.5 whitespace-nowrap"
              style={{
                backgroundColor: isActive ? "var(--forest)" : "var(--card)",
                color: isActive ? "#fff" : "var(--muted)",
              }}
            >
              {tab.label}
              <Badge count={badges[tab.id] ?? 0} />
            </button>
          );
        })}
      </div>

      {/* All panels stay mounted so the tab badges track live data and
          switching is instant; only the active one is visible. */}
      <div id="panel-messages" role="tabpanel" hidden={active !== "messages"}>
        <MessagesInbox />
      </div>
      <div id="panel-pending" role="tabpanel" hidden={active !== "pending"}>
        <ReviewQueue />
      </div>
      <div id="panel-published" role="tabpanel" hidden={active !== "published"}>
        <PublishedPapers />
      </div>
      <div id="panel-words" role="tabpanel" hidden={active !== "words"}>
        <WordsPanel />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AdminDataProvider>
      <Tabs />
    </AdminDataProvider>
  );
}
