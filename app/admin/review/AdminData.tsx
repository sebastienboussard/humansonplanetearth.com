"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  movePaperToPublished,
  removePaper,
  sortPublished,
  unreadCount,
  type AdminMessage,
  type AdminPaper,
} from "@/lib/admin-queue";

export type AdminWord = {
  id: string;
  word: string;
  month: number;
  year: number;
  deadline: string;
};

export type Dataset = "messages" | "pending" | "published" | "words";

export type NewWordInput = {
  word: string;
  month: string;
  year: string;
  deadline: string;
};

type AdminDataValue = {
  messages: AdminMessage[];
  pending: AdminPaper[];
  published: AdminPaper[];
  words: AdminWord[];
  unread: number;
  loading: Record<Dataset, boolean>;
  error: string | null;
  dismissError: () => void;
  refresh: (key: Dataset) => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
  removePublished: (id: string) => Promise<void>;
  setMessageRead: (id: string, read: boolean) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  /** Resolves to an error message, or null on success. */
  addWord: (input: NewWordInput) => Promise<string | null>;
};

const AdminDataContext = createContext<AdminDataValue | null>(null);

export function useAdminData(): AdminDataValue {
  const value = useContext(AdminDataContext);
  if (!value) {
    throw new Error("useAdminData must be used inside <AdminDataProvider>");
  }
  return value;
}

// Admin reads are cookie-authed and change constantly — never let the browser
// serve one from its HTTP cache.
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return (await res.json()) as T;
}

async function send(url: string, method: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return (data as { error?: string }).error ?? "Something went wrong.";
  } catch {
    return "Could not reach the server.";
  }
}

const ALL_DATASETS: Dataset[] = ["messages", "pending", "published", "words"];

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  // Pending and published live in one piece of state so a paper can only ever
  // leave one list and join the other in the same update — the two used to be
  // owned by separate components, which is how approved papers went missing
  // from the published history.
  const [papers, setPapers] = useState<{ pending: AdminPaper[]; published: AdminPaper[] }>({
    pending: [],
    published: [],
  });
  const [words, setWords] = useState<AdminWord[]>([]);
  const [loading, setLoading] = useState<Record<Dataset, boolean>>({
    messages: true,
    pending: true,
    published: true,
    words: true,
  });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (key: Dataset) => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      if (key === "messages") {
        const data = await getJson<{ messages?: AdminMessage[] }>("/api/admin/messages");
        setMessages(data.messages ?? []);
      } else if (key === "pending") {
        const data = await getJson<{ papers?: AdminPaper[] }>("/api/admin/review");
        setPapers((prev) => ({ ...prev, pending: data.papers ?? [] }));
      } else if (key === "published") {
        const data = await getJson<{ papers?: AdminPaper[] }>(
          "/api/admin/review?status=approved"
        );
        setPapers((prev) => ({ ...prev, published: sortPublished(data.papers ?? []) }));
      } else {
        const data = await getJson<{ words?: AdminWord[] }>("/api/admin/words");
        setWords(data.words ?? []);
      }
    } catch (err) {
      console.error("Admin load error:", err);
      setError("Could not load the latest data. Try reloading the page.");
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  useEffect(() => {
    ALL_DATASETS.forEach((key) => {
      void refresh(key);
    });
  }, [refresh]);

  const approve = useCallback(
    async (id: string) => {
      const failure = await send("/api/admin/review", "PATCH", { id, status: "approved" });
      if (failure) {
        setError(failure);
        return;
      }
      // Show it in the published history immediately, then reconcile against
      // the server so the row carries whatever the API actually returns.
      setPapers((prev) => movePaperToPublished(prev.pending, prev.published, id));
      void refresh("published");
    },
    [refresh]
  );

  const reject = useCallback(async (id: string) => {
    const failure = await send("/api/admin/review", "PATCH", { id, status: "rejected" });
    if (failure) {
      setError(failure);
      return;
    }
    setPapers((prev) => ({ ...prev, pending: removePaper(prev.pending, id) }));
  }, []);

  const removePublished = useCallback(async (id: string) => {
    const failure = await send("/api/admin/review", "DELETE", { id });
    if (failure) {
      setError(failure);
      return;
    }
    setPapers((prev) => ({ ...prev, published: removePaper(prev.published, id) }));
  }, []);

  const setMessageRead = useCallback(async (id: string, read: boolean) => {
    const failure = await send("/api/admin/messages", "PATCH", { id, read });
    if (failure) {
      setError(failure);
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read } : m)));
  }, []);

  const deleteMessage = useCallback(async (id: string) => {
    const failure = await send("/api/admin/messages", "DELETE", { id });
    if (failure) {
      setError(failure);
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const addWord = useCallback(
    async (input: NewWordInput) => {
      const failure = await send("/api/admin/words", "POST", input);
      if (!failure) void refresh("words");
      return failure;
    },
    [refresh]
  );

  const value = useMemo<AdminDataValue>(
    () => ({
      messages,
      pending: papers.pending,
      published: papers.published,
      words,
      unread: unreadCount(messages),
      loading,
      error,
      dismissError: () => setError(null),
      refresh,
      approve,
      reject,
      removePublished,
      setMessageRead,
      deleteMessage,
      addWord,
    }),
    [
      messages,
      papers,
      words,
      loading,
      error,
      refresh,
      approve,
      reject,
      removePublished,
      setMessageRead,
      deleteMessage,
      addWord,
    ]
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}
