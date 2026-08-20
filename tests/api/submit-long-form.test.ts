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

import { POST } from "@/app/api/submit/long-form/route";
import { notifyAdminNewPaper } from "@/lib/admin-alerts";

const URL = "http://localhost:3000/api/submit/long-form";

function buildForm(fields: {
  pdf?: File;
  title?: string;
  tags?: string;
  _trap?: string;
  attach?: string;
}): FormData {
  const form = new FormData();
  if (fields.pdf) form.append("pdf", fields.pdf);
  if (fields.title !== undefined) form.append("title", fields.title);
  if (fields.tags !== undefined) form.append("tags", fields.tags);
  if (fields._trap !== undefined) form.append("_trap", fields._trap);
  if (fields.attach !== undefined) form.append("attach", fields.attach);
  return form;
}

afterEach(() => {
  holder.current = null;
  profileHolder.current = null;
  vi.mocked(notifyAdminNewPaper).mockClear();
  vi.mocked(notifyAdminNewPaper).mockResolvedValue(undefined);
});

describe("POST /api/submit/long-form", () => {
  it("silently discards honeypot submissions", async () => {
    holder.current = createMockSupabase();
    const form = buildForm({ pdf: await makePdfFile(), title: "Essay", _trap: "bot" });

    const res = await POST(formRequest(URL, form));

    expect(await res.json()).toEqual({ ok: true });
    expect(holder.current.from).not.toHaveBeenCalled();
  });

  it("requires both a PDF and a title", async () => {
    holder.current = createMockSupabase();
    expect((await POST(formRequest(URL, buildForm({ title: "Essay" })))).status).toBe(400);
    expect((await POST(formRequest(URL, buildForm({ pdf: await makePdfFile() })))).status).toBe(400);
  });

  it("treats a whitespace-only title as missing", async () => {
    holder.current = createMockSupabase();
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "   " })));
    expect(res.status).toBe(400);
  });

  it("rejects non-PDF mime types", async () => {
    holder.current = createMockSupabase();
    const pdf = await makePdfFile({ type: "application/msword" });
    const res = await POST(formRequest(URL, buildForm({ pdf, title: "Essay" })));
    expect(res.status).toBe(400);
  });

  it("rejects files over 4.5 MB", async () => {
    // 4.5 MB is the ceiling: Vercel refuses a serverless request body above
    // roughly that before our handler runs at all, so nothing higher is
    // enforceable here.
    holder.current = createMockSupabase();
    const pdf = makeFileOfSize(4.5 * 1024 * 1024 + 1);
    const res = await POST(formRequest(URL, buildForm({ pdf, title: "Essay" })));

    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/4\.5 MB/);
  });

  it("rejects files that claim to be PDFs but fail parsing", async () => {
    holder.current = createMockSupabase();
    const res = await POST(formRequest(URL, buildForm({ pdf: makeCorruptPdfFile(), title: "Essay" })));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid PDF file.");
  });

  it("allows multi-page PDFs (no page limit for long-form)", async () => {
    holder.current = createMockSupabase({ tables: { papers: { data: null } } });
    const pdf = await makePdfFile({ pages: 12 });
    const res = await POST(formRequest(URL, buildForm({ pdf, title: "Essay" })));
    expect(res.status).toBe(200);
  });

  it("returns 500 when the storage upload fails", async () => {
    holder.current = createMockSupabase({
      storage: { uploadError: { message: "bucket unavailable" } },
    });
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "Essay" })));
    expect(res.status).toBe(500);
  });

  it("returns 500 when the papers insert fails", async () => {
    holder.current = createMockSupabase({
      tables: { papers: { error: { message: "insert failed" } } },
    });
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "Essay" })));
    expect(res.status).toBe(500);
  });

  // The upload commits before the insert, so a failed insert leaves a file in
  // the bucket that nothing references — unless the route takes it back.
  it("removes the uploaded file when the papers insert fails", async () => {
    holder.current = createMockSupabase({
      tables: { papers: [{ error: { message: "insert failed" } }, { data: [] }] },
    });
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "Essay" })));

    expect(res.status).toBe(500);
    const bucket = holder.current.bucket("papers")!;
    const [filename] = bucket.upload.mock.calls[0];
    expect(bucket.remove).toHaveBeenCalledWith([filename]);
  });

  // A timed-out insert may have committed and lost only the reply. Deleting
  // the file then would leave a live row pointing at missing storage, which is
  // the worse failure of the two.
  it("keeps the uploaded file when a row already claims it", async () => {
    holder.current = createMockSupabase({
      tables: {
        papers: [{ error: { message: "insert failed" } }, { data: [{ id: "paper-1" }] }],
      },
    });
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "Essay" })));

    expect(res.status).toBe(500);
    expect(holder.current.bucket("papers")!.remove).not.toHaveBeenCalled();
  });

  it("keeps the uploaded file when the orphan check itself fails", async () => {
    holder.current = createMockSupabase({
      tables: {
        papers: [{ error: { message: "insert failed" } }, { error: { message: "db unreachable" } }],
      },
    });
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "Essay" })));

    expect(res.status).toBe(500);
    expect(holder.current.bucket("papers")!.remove).not.toHaveBeenCalled();
  });

  it("never removes the file on a successful submission", async () => {
    holder.current = createMockSupabase({ tables: { papers: { data: null } } });
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "Essay" })));

    expect(res.status).toBe(200);
    expect(holder.current.bucket("papers")!.remove).not.toHaveBeenCalled();
  });

  it("stores a valid submission as a pending long-form paper with a trimmed title", async () => {
    holder.current = createMockSupabase({ tables: { papers: { data: null } } });
    const form = buildForm({ pdf: await makePdfFile(), title: "  My Essay  " });

    const res = await POST(formRequest(URL, form));

    expect(res.status).toBe(200);
    const bucket = holder.current.bucket("papers")!;
    const [filename] = bucket.upload.mock.calls[0];
    expect(filename).toMatch(/^long-form\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/);

    expect(holder.current.query("papers")!.insert).toHaveBeenCalledWith({
      word_id: null,
      type: "long-form",
      title: "My Essay",
      pdf_url: filename,
      status: "pending",
      tags: [],
    });
  });

  it("alerts the admin inbox with the trimmed title after a successful submission", async () => {
    holder.current = createMockSupabase({ tables: { papers: { data: null } } });
    const res = await POST(
      formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "  My Essay  " }))
    );

    expect(res.status).toBe(200);
    expect(notifyAdminNewPaper).toHaveBeenCalledWith({
      type: "long-form",
      word: null,
      title: "My Essay",
    });
  });

  it("does not alert the admin when the insert fails", async () => {
    holder.current = createMockSupabase({
      tables: { papers: { error: { message: "insert failed" } } },
    });
    await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "Essay" })));
    expect(notifyAdminNewPaper).not.toHaveBeenCalled();
  });

  it("still succeeds when the admin alert rejects", async () => {
    vi.mocked(notifyAdminNewPaper).mockRejectedValueOnce(new Error("resend down"));
    holder.current = createMockSupabase({ tables: { papers: { data: null } } });
    const res = await POST(formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "Essay" })));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("attaches the paper to the signed-in profile when attach=1", async () => {
    profileHolder.current = { id: "prof-1", user_id: "user-1", email: "h@example.com" };
    holder.current = createMockSupabase({
      tables: {
        papers: { data: { id: "paper-1" } },
        paper_authors: { data: null },
      },
    });

    const res = await POST(
      formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "Essay", attach: "1" }))
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
      tables: { papers: { data: { id: "paper-1" } } },
    });

    const res = await POST(
      formRequest(URL, buildForm({ pdf: await makePdfFile(), title: "Essay", attach: "1" }))
    );

    expect(res.status).toBe(200);
    expect(holder.current.query("paper_authors")).toBeUndefined();
  });

  it("refuses further uploads once the hourly window is spent", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: [{ allowed: false, hits: 4, retry_after: 900 }] } },
    });

    const pdf = await makePdfFile();
    const res = await POST(formRequest(URL, buildForm({ pdf, title: "Essay" })));

    expect(res.status).toBe(429);
    expect(holder.current.bucket("papers")).toBeUndefined();
  });

  it("rejects an oversized body on content-length before buffering it", async () => {
    // req.formData() reads the whole request first, so the declared length is
    // the only chance to refuse a large upload cheaply.
    holder.current = createMockSupabase();
    const form = buildForm({ pdf: await makePdfFile(), title: "Essay" });
    const res = await POST(
      formRequest(URL, form, { headers: { "content-length": String(9 * 1024 * 1024) } })
    );

    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/4\.5 MB/);
  });
});
