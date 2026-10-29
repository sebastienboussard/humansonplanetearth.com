import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createMockSupabase, type MockSupabase, type QueryResult } from "../helpers/supabase-mock";
import { makePdfFile, makeCorruptPdfFile } from "../helpers/pdf";
import { formRequest } from "../helpers/request";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

const profileHolder = vi.hoisted(
  () => ({ current: null }) as import("../helpers/auth-mock").ProfileHolder
);
vi.mock("@/lib/profile", async () =>
  (await import("../helpers/auth-mock")).profileModuleMock(profileHolder)
);

vi.mock("@/lib/admin-alerts", () => ({
  notifyAdminPaperEdit: vi.fn(async () => undefined),
}));

import { POST } from "@/app/api/account/papers/edit/route";
import { notifyAdminPaperEdit } from "@/lib/admin-alerts";

// Change requests on papers (TODO §24).

const URL = "http://localhost:3000/api/account/papers/edit";
const profile = { id: "prof-1", user_id: "user-1", email: "human@example.com" };

function ownedPaper(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      paper_id: "p1",
      papers: {
        id: "p1",
        type: "word",
        title: null,
        status: "approved",
        pdf_url: "word-1/old.pdf",
        words: { word: "threshold" },
        ...overrides,
      },
    },
  };
}

function buildForm(fields: { paperId?: string; pdf?: File; note?: string }): FormData {
  const form = new FormData();
  if (fields.paperId !== undefined) form.append("paperId", fields.paperId);
  if (fields.pdf) form.append("pdf", fields.pdf);
  if (fields.note !== undefined) form.append("note", fields.note);
  return form;
}

function client(editRequests: QueryResult[] = [{ data: [] }, { data: null }], owned: QueryResult = ownedPaper()) {
  return createMockSupabase({
    tables: { paper_authors: owned, paper_edit_requests: editRequests },
  });
}

afterEach(() => {
  holder.current = null;
  profileHolder.current = null;
  vi.mocked(notifyAdminPaperEdit).mockClear();
  vi.mocked(notifyAdminPaperEdit).mockResolvedValue(undefined);
});

describe("POST /api/account/papers/edit", () => {
  it("returns 401 when not signed in", async () => {
    holder.current = client();
    const res = await POST(formRequest(URL, buildForm({ paperId: "p1", pdf: await makePdfFile() })));
    expect(res.status).toBe(401);
    expect(holder.current.query("paper_authors")).toBeUndefined();
  });

  it("returns 400 when the paper or the file is missing", async () => {
    profileHolder.current = profile;
    holder.current = client();
    const res = await POST(formRequest(URL, buildForm({ paperId: "p1" })));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a paper that is not the caller's, checked against their profile", async () => {
    profileHolder.current = profile;
    holder.current = client(undefined, { data: null });

    const res = await POST(formRequest(URL, buildForm({ paperId: "p9", pdf: await makePdfFile() })));

    expect(res.status).toBe(404);
    const lookup = holder.current.query("paper_authors")!;
    expect(lookup.eq).toHaveBeenCalledWith("paper_id", "p9");
    expect(lookup.eq).toHaveBeenCalledWith("profile_id", "prof-1");
    expect(holder.current.bucket("papers")).toBeUndefined();
  });

  it("fails closed when the ownership lookup errors", async () => {
    profileHolder.current = profile;
    holder.current = client(undefined, { error: { message: "boom" } });
    const res = await POST(formRequest(URL, buildForm({ paperId: "p1", pdf: await makePdfFile() })));
    expect(res.status).toBe(404);
  });

  it("refuses a rejected paper", async () => {
    profileHolder.current = profile;
    holder.current = client(undefined, ownedPaper({ status: "rejected" }));
    const res = await POST(formRequest(URL, buildForm({ paperId: "p1", pdf: await makePdfFile() })));
    expect(res.status).toBe(409);
  });

  it("refuses a second request while one is waiting", async () => {
    profileHolder.current = profile;
    holder.current = client([{ data: [{ id: "e0" }] }]);
    const res = await POST(formRequest(URL, buildForm({ paperId: "p1", pdf: await makePdfFile() })));
    expect(res.status).toBe(409);
    expect(holder.current.bucket("papers")).toBeUndefined();
  });

  it("holds a word paper to one page", async () => {
    profileHolder.current = profile;
    holder.current = client();
    const res = await POST(
      formRequest(URL, buildForm({ paperId: "p1", pdf: await makePdfFile({ pages: 2 }) }))
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/2 pages/);
  });

  it("lets a long-form paper run longer", async () => {
    profileHolder.current = profile;
    holder.current = client(undefined, ownedPaper({ type: "long-form", title: "On Rivers", pdf_url: "long-form/old.pdf" }));
    const res = await POST(
      formRequest(URL, buildForm({ paperId: "p1", pdf: await makePdfFile({ pages: 3 }) }))
    );
    expect(res.status).toBe(200);
    const [path] = holder.current.bucket("papers")!.upload.mock.calls[0];
    expect(path).toMatch(/^long-form\/[0-9a-f-]{36}\.pdf$/);
  });

  it("rejects a file that is not a PDF", async () => {
    profileHolder.current = profile;
    holder.current = client();
    const res = await POST(formRequest(URL, buildForm({ paperId: "p1", pdf: makeCorruptPdfFile() })));
    expect(res.status).toBe(400);
  });

  it("stores a stripped replacement beside the original and records the request", async () => {
    profileHolder.current = profile;
    holder.current = client();

    const doc = await PDFDocument.create();
    doc.addPage();
    doc.setAuthor("Jane Realname");
    const pdf = new File([(await doc.save()) as BlobPart], "mine.pdf", { type: "application/pdf" });

    const res = await POST(formRequest(URL, buildForm({ paperId: "p1", pdf, note: "  Fixed a typo  " })));

    expect(res.status).toBe(200);
    const [path, bytes] = holder.current.bucket("papers")!.upload.mock.calls[0];
    expect(path).toMatch(/^word-1\/[0-9a-f-]{36}\.pdf$/);
    expect(path).not.toBe("word-1/old.pdf");
    expect((await PDFDocument.load(bytes)).getAuthor() ?? "").toBe("");

    const insert = holder.current.query("paper_edit_requests", 1)!;
    expect(insert.insert).toHaveBeenCalledWith({ paper_id: "p1", pdf_path: path, note: "Fixed a typo" });
    // The paper itself is untouched until the admin applies the change.
    expect(holder.current.query("papers")).toBeUndefined();
    expect(notifyAdminPaperEdit).toHaveBeenCalledWith({ type: "word", word: "threshold", title: null });
  });

  it("cleans up the upload when the insert fails", async () => {
    profileHolder.current = profile;
    // Pending check, the failed insert, then the orphan check finding no row.
    holder.current = client([{ data: [] }, { error: { message: "boom" } }, { data: [] }]);

    const res = await POST(formRequest(URL, buildForm({ paperId: "p1", pdf: await makePdfFile() })));

    expect(res.status).toBe(500);
    const bucket = holder.current.bucket("papers")!;
    const [path] = bucket.upload.mock.calls[0];
    expect(holder.current.query("paper_edit_requests", 2)!.eq).toHaveBeenCalledWith("pdf_path", path);
    expect(bucket.remove).toHaveBeenCalledWith([path]);
  });

  it("reports a request that lost the race to another as 409", async () => {
    profileHolder.current = profile;
    holder.current = client([
      { data: [] },
      { error: { message: "duplicate key", code: "23505" } as { message: string } },
      { data: [] },
    ]);

    const res = await POST(formRequest(URL, buildForm({ paperId: "p1", pdf: await makePdfFile() })));

    expect(res.status).toBe(409);
  });

  it("still succeeds when the admin alert fails", async () => {
    profileHolder.current = profile;
    holder.current = client();
    vi.mocked(notifyAdminPaperEdit).mockRejectedValueOnce(new Error("mail down"));

    const res = await POST(formRequest(URL, buildForm({ paperId: "p1", pdf: await makePdfFile() })));

    expect(res.status).toBe(200);
  });

  it("refuses a note over the limit", async () => {
    profileHolder.current = profile;
    holder.current = client();
    const res = await POST(
      formRequest(URL, buildForm({ paperId: "p1", pdf: await makePdfFile(), note: "x".repeat(1001) }))
    );
    expect(res.status).toBe(400);
  });
});
