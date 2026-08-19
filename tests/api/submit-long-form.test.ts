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

  it("rejects files over 10 MB", async () => {
    holder.current = createMockSupabase();
    const pdf = makeFileOfSize(10 * 1024 * 1024 + 1);
    const res = await POST(formRequest(URL, buildForm({ pdf, title: "Essay" })));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/10 MB/);
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

  it("stores a valid submission as a pending long-form paper with a trimmed title", async () => {
    holder.current = createMockSupabase({ tables: { papers: { data: null } } });
    const form = buildForm({ pdf: await makePdfFile(), title: "  My Essay  " });

    const res = await POST(formRequest(URL, form));

    expect(res.status).toBe(200);
    const bucket = holder.current.bucket("papers")!;
    const [filename] = bucket.upload.mock.calls[0];
    expect(filename).toMatch(/^long-form\/\d+\.pdf$/);

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
});
