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

import { POST } from "@/app/api/submit/route";

const URL = "http://localhost:3000/api/submit";

function buildForm(fields: {
  pdf?: File;
  word?: string;
  _trap?: string;
  attach?: string;
}): FormData {
  const form = new FormData();
  if (fields.pdf) form.append("pdf", fields.pdf);
  if (fields.word !== undefined) form.append("word", fields.word);
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
    expect(filename).toMatch(/^word-1\/\d+\.pdf$/);
    expect(uploadOpts).toMatchObject({ contentType: "application/pdf", upsert: false });

    const insert = holder.current.query("papers")!.insert;
    expect(insert).toHaveBeenCalledWith({
      word_id: "word-1",
      type: "word",
      pdf_url: filename,
      status: "pending",
    });
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
});
