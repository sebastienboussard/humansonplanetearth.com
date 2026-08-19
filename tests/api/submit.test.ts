import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { makePdfFile, makeFileOfSize, makeCorruptPdfFile } from "../helpers/pdf";
import { formRequest } from "../helpers/request";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

// Anonymous by default; attach tests sign a profile in.
const profileHolder = vi.hoisted(
  () => ({ current: null }) as import("../helpers/auth-mock").ProfileHolder
);
vi.mock("@/lib/profile", async () =>
  (await import("../helpers/auth-mock")).profileModuleMock(profileHolder)
);

vi.mock("@/lib/admin-alerts", () => ({
  notifyAdminNewPaper: vi.fn(async () => undefined),
  notifyAdminNewMessage: vi.fn(async () => false),
}));

import { POST } from "@/app/api/submit/route";
import { notifyAdminNewPaper } from "@/lib/admin-alerts";

const URL = "http://localhost:3000/api/submit";

function buildForm(fields: {
  pdf?: File;
  word?: string;
  tags?: string;
  _trap?: string;
  attach?: string;
}): FormData {
  const form = new FormData();
  if (fields.pdf) form.append("pdf", fields.pdf);
  if (fields.word !== undefined) form.append("word", fields.word);
  if (fields.tags !== undefined) form.append("tags", fields.tags);
  if (fields._trap !== undefined) form.append("_trap", fields._trap);
  if (fields.attach !== undefined) form.append("attach", fields.attach);
  return form;
}

function successfulClient() {
  return createMockSupabase({
    tables: {
      words: { data: { id: "word-1" } },
      papers: { data: null },
    },
  });
}

afterEach(() => {
  holder.current = null;
  profileHolder.current = null;
  vi.mocked(notifyAdminNewPaper).mockClear();
  vi.mocked(notifyAdminNewPaper).mockResolvedValue(undefined);
});

describe("POST /api/submit", () => {
  it("silently discards honeypot submissions without touching the database", async () => {
    holder.current = successfulClient();
    const form = buildForm({ pdf: await makePdfFile(), word: "hope", _trap: "bot-filled" });

    const res = await POST(formRequest(URL, form));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(holder.current.from).not.toHaveBeenCalled();
  });

  it("rejects a submission with no PDF", async () => {
    holder.current = successfulClient();
    const res = await POST(formRequest(URL, buildForm({ word: "hope" })));
    expect(res.status).toBe(400);
  });

  it("rejects a submission with no word", async () => {
    holder.current = successfulClient();
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile() })));
    expect(res.status).toBe(400);
  });

  it("rejects non-PDF mime types", async () => {
    holder.current = successfulClient();
    const pdf = await makePdfFile({ type: "text/plain", name: "paper.txt" });
    const res = await POST(formRequest(URL, buildForm({ pdf, word: "hope" })));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Only PDF/);
  });

  it("rejects files over 2 MB", async () => {
    holder.current = successfulClient();
    const pdf = makeFileOfSize(2 * 1024 * 1024 + 1);
    const res = await POST(formRequest(URL, buildForm({ pdf, word: "hope" })));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/2 MB/);
  });

  it("rejects PDFs with more than one page", async () => {
    holder.current = successfulClient();
    const pdf = await makePdfFile({ pages: 3 });
    const res = await POST(formRequest(URL, buildForm({ pdf, word: "hope" })));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/3 pages/);
  });

  it("returns 500 for a corrupt PDF (parse failure hits the catch-all)", async () => {
    holder.current = successfulClient();
    const res = await POST(formRequest(URL, buildForm({ pdf: makeCorruptPdfFile(), word: "hope" })));
    expect(res.status).toBe(500);
  });

  it("returns 404 when the word does not exist", async () => {
    holder.current = createMockSupabase({
      tables: { words: { data: null, error: { message: "No rows" } } },
    });
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), word: "nope" })));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Word not found.");
  });

  it("normalizes the word to lowercase before lookup", async () => {
    holder.current = successfulClient();
    const form = buildForm({ pdf: await makePdfFile(), word: "  HoPe  " });

    await POST(formRequest(URL, form));

    const q = holder.current.query("words")!;
    expect(q.eq).toHaveBeenCalledWith("word", "hope");
  });

  it("returns 500 when the storage upload fails", async () => {
    holder.current = createMockSupabase({
      tables: { words: { data: { id: "word-1" } } },
      storage: { uploadError: { message: "bucket unavailable" } },
    });
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), word: "hope" })));
    expect(res.status).toBe(500);
  });

  it("returns 500 when the papers insert fails", async () => {
    holder.current = createMockSupabase({
      tables: {
        words: { data: { id: "word-1" } },
        papers: { error: { message: "insert failed" } },
      },
    });
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), word: "hope" })));
    expect(res.status).toBe(500);
  });

  it("accepts a valid one-page PDF and stores it as a pending paper", async () => {
    holder.current = successfulClient();
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), word: "hope" })));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const bucket = holder.current.bucket("papers")!;
    expect(bucket.upload).toHaveBeenCalledTimes(1);
    const [filename, , uploadOpts] = bucket.upload.mock.calls[0];
    expect(filename).toMatch(/^word-1\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/);
    expect(uploadOpts).toMatchObject({ contentType: "application/pdf", upsert: false });

    const insert = holder.current.query("papers")!.insert;
    expect(insert).toHaveBeenCalledWith({
      word_id: "word-1",
      type: "word",
      pdf_url: filename,
      status: "pending",
      tags: [],
    });
  });

  it("alerts the admin inbox after a successful submission", async () => {
    holder.current = successfulClient();
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), word: "hope" })));

    expect(res.status).toBe(200);
    expect(notifyAdminNewPaper).toHaveBeenCalledWith({ type: "word", word: "hope", title: null });
  });

  it("does not alert the admin when the insert fails", async () => {
    holder.current = createMockSupabase({
      tables: {
        words: { data: { id: "word-1" } },
        papers: { error: { message: "insert failed" } },
      },
    });
    await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), word: "hope" })));
    expect(notifyAdminNewPaper).not.toHaveBeenCalled();
  });

  it("still succeeds when the admin alert rejects", async () => {
    vi.mocked(notifyAdminNewPaper).mockRejectedValueOnce(new Error("resend down"));
    holder.current = successfulClient();
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), word: "hope" })));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("normalizes submitted hashtags server-side before storing them", async () => {
    holder.current = successfulClient();
    const form = buildForm({
      pdf: await makePdfFile(),
      word: "hope",
      tags: "#Quiet, memory  #QUIET !!! grief",
    });

    const res = await POST(formRequest(URL, form));
    expect(res.status).toBe(200);

    // lowercased, de-hashed, deduped, junk dropped — never the raw client string
    expect(holder.current.query("papers")!.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["quiet", "memory", "grief"] })
    );
  });

  it("caps stored hashtags at 10 regardless of how many were submitted", async () => {
    holder.current = successfulClient();
    const many = Array.from({ length: 25 }, (_, i) => `#tag${i}`).join(" ");
    const res = await POST(
      formRequest(URL, buildForm({ pdf: await makePdfFile(), word: "hope", tags: many }))
    );

    expect(res.status).toBe(200);
    const [payload] = holder.current.query("papers")!.insert.mock.calls[0];
    expect(payload.tags).toHaveLength(10);
  });

  it("attaches the paper to the signed-in profile when attach=1", async () => {
    profileHolder.current = { id: "prof-1", user_id: "user-1", email: "h@example.com" };
    holder.current = createMockSupabase({
      tables: {
        words: { data: { id: "word-1" } },
        papers: { data: { id: "paper-1" } },
        paper_authors: { data: null },
      },
    });

    const res = await POST(
      formRequest(URL, buildForm({ pdf: await makePdfFile(), word: "hope", attach: "1" }))
    );

    expect(res.status).toBe(200);
    expect(holder.current.query("paper_authors")!.insert).toHaveBeenCalledWith({
      paper_id: "paper-1",
      profile_id: "prof-1",
      public_visible: false,
    });
  });

  it("ignores attach=1 without a server-side session", async () => {
    holder.current = createMockSupabase({
      tables: {
        words: { data: { id: "word-1" } },
        papers: { data: { id: "paper-1" } },
      },
    });

    const res = await POST(
      formRequest(URL, buildForm({ pdf: await makePdfFile(), word: "hope", attach: "1" }))
    );

    expect(res.status).toBe(200);
    expect(holder.current.query("paper_authors")).toBeUndefined();
  });

  it("still succeeds when the attach insert fails", async () => {
    profileHolder.current = { id: "prof-1", user_id: "user-1", email: "h@example.com" };
    holder.current = createMockSupabase({
      tables: {
        words: { data: { id: "word-1" } },
        papers: { data: { id: "paper-1" } },
        paper_authors: { error: { message: "boom" } },
      },
    });

    const res = await POST(
      formRequest(URL, buildForm({ pdf: await makePdfFile(), word: "hope", attach: "1" }))
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("refuses further uploads once the hourly window is spent", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: [{ allowed: false, hits: 6, retry_after: 1800 }] } },
    });

    const pdf = await makePdfFile();
    const res = await POST(formRequest(URL, buildForm({ pdf, word: "hope" })));

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("1800");
    // Refused before anything is parsed, stored or written.
    expect(holder.current.bucket("papers")).toBeUndefined();
    expect(holder.current.queries).toHaveLength(0);
  });

  it("keys the limiter on the forwarded client IP", async () => {
    holder.current = successfulClient();
    const pdf = await makePdfFile();

    await POST(
      formRequest(URL, buildForm({ pdf, word: "hope" }), {
        headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
      })
    );

    expect(holder.current.rpcCalls[0]).toMatchObject({
      fn: "rate_limit_hit",
      args: { p_key: "submit:203.0.113.9", p_max: 5 },
    });
  });

  it("still accepts the submission when the rate-limit store is down", async () => {
    // Fail open — a database blip must not close submissions.
    const client = successfulClient();
    client.rpc.mockRejectedValueOnce(new Error("store unreachable"));
    holder.current = client;

    const pdf = await makePdfFile();
    const res = await POST(formRequest(URL, buildForm({ pdf, word: "hope" })));

    expect(res.status).toBe(200);
  });
});
