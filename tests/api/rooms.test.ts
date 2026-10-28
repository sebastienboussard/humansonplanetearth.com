import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { type ProfileHolder } from "../helpers/auth-mock";
import { getRequest, jsonRequest, malformedJsonRequest } from "../helpers/request";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);
const profileHolder = vi.hoisted(() => ({ current: null }) as ProfileHolder);
vi.mock("@/lib/profile", async () =>
  (await import("../helpers/auth-mock")).profileModuleMock(profileHolder)
);
vi.mock("@/lib/admin-alerts", () => ({ notifyAdminNewRoomPage: vi.fn(async () => {}) }));

import { POST as createRoom } from "@/app/api/rooms/route";
import { GET as getPages, POST as postPage } from "@/app/api/rooms/pages/route";
import { GET as getMargins, POST as postMargin } from "@/app/api/rooms/margins/route";
import { notifyAdminNewRoomPage } from "@/lib/admin-alerts";

const BASE = "http://localhost:3000/api/rooms";
const profile = { id: "prof-1", user_id: "user-1", email: "reader@example.com" };
const allow = { data: [{ allowed: true, hits: 1, retry_after: 0 }] };
const pgError = (message: string, code: string) => ({ message, code }) as { message: string };
const room = { title: "Middlemarch", medium: "book", sections: ["Book One", "Book Two"] };

/** No response from these routes may name, or point at, whoever wrote anything. */
function expectNoAuthor(body: unknown) {
  expect(JSON.stringify(body)).not.toMatch(/profile|email|author|user_id|prof-1|reader@/i);
}

afterEach(() => {
  holder.current = null;
  profileHolder.current = null;
  vi.mocked(notifyAdminNewRoomPage).mockClear();
});

describe("POST /api/rooms", () => {
  it("is rate-limited per IP before anything else", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: [{ allowed: false, hits: 6, retry_after: 600 }] } },
    });
    const res = await createRoom(jsonRequest(BASE, room, { headers: { "x-forwarded-for": "203.0.113.3" } }));
    expect(res.status).toBe(429);
    expect(holder.current.rpcCalls[0]?.args).toMatchObject({ p_key: "room-create:203.0.113.3" });
  });


  it("needs a signed-in account", async () => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
    expect((await createRoom(jsonRequest(BASE, room))).status).toBe(401);
  });

  it("silently discards honeypot submissions", async () => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
    const res = await createRoom(jsonRequest(BASE, { ...room, _trap: "bot" }));
    expect(await res.json()).toEqual({ ok: true });
    expect(holder.current.rpcCalls.map((c) => c.fn)).not.toContain("create_room");
  });

  it.each([
    ["no title", { ...room, title: "  " }],
    ["an unknown medium", { ...room, medium: "podcast" }],
    ["a year that isn't one", { ...room, year: "soon" }],
    ["a 121-character section", { ...room, sections: ["x".repeat(121)] }],
    ["an overlong introduction", { ...room, intro: "x".repeat(2001) }],
    ["a data: link", { ...room, links: ["data:text/html,hi"] }],
  ])("refuses %s before calling the database", async (_label, body) => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
    expect((await createRoom(jsonRequest(BASE, body))).status).toBe(400);
    expect(holder.current.rpcCalls.map((c) => c.fn)).not.toContain("create_room");
  });

  it("refuses a body that is not JSON", async () => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
    expect((await createRoom(malformedJsonRequest(BASE))).status).toBe(400);
  });

  it("opens the room in one call, with the whole work appended last", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow, create_room: { data: "room-1" } } });

    const res = await createRoom(
      jsonRequest(BASE, { ...room, creator: " George Eliot ", year: "1871", links: ["gutenberg.org/ebooks/145", ""] })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ slug: "middlemarch" });
    expectNoAuthor(body);

    const call = holder.current.rpcCalls.find((c) => c.fn === "create_room")!;
    expect(call.args).toMatchObject({
      p_profile_id: "prof-1",
      p_slug: "middlemarch",
      p_title: "Middlemarch",
      p_creator_name: "George Eliot",
      p_medium: "book",
      p_year: 1871,
      p_links: [{ url: "https://gutenberg.org/ebooks/145" }],
      p_sections: [
        { label: "Book One", kind: "part" },
        { label: "Book Two", kind: "part" },
        { label: "The whole work", kind: "whole" },
      ],
    });
  });

  it("retries once with a suffix when the slug is taken", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow, create_room: { error: pgError('duplicate key "rooms_slug_key"', "23505") } },
    });
    const res = await createRoom(jsonRequest(BASE, room));
    const slugs = holder.current.rpcCalls.filter((c) => c.fn === "create_room").map((c) => (c.args as { p_slug: string }).p_slug);
    expect(slugs).toHaveLength(2);
    expect(slugs[0]).toBe("middlemarch");
    expect(slugs[1]).toMatch(/^middlemarch-[a-z2-9]{4}$/);
    expect(res.status).toBe(500); // the mock refuses both
  });

  it("maps the 3-a-day cap to a 409 that says when to try again", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow, create_room: { error: pgError("room_cap", "23514") } },
    });
    const res = await createRoom(jsonRequest(BASE, room));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/three rooms/);
  });
});

describe("GET /api/rooms/pages", () => {
  it("needs a section", async () => {
    holder.current = createMockSupabase();
    expect((await getPages(getRequest(`${BASE}/pages`))).status).toBe(400);
  });

  it("returns only approved pages, with no author", async () => {
    const pages = [{ id: "p1", title: "On debt", body: "…", quote: null, locator: null, submitted_at: "x" }];
    holder.current = createMockSupabase({ tables: { room_pages: { data: pages } } });
    const res = await getPages(getRequest(`${BASE}/pages?section=s1`));
    const body = await res.json();
    expect(body).toEqual({ pages });
    expectNoAuthor(body);
    const q = holder.current.query("room_pages")!;
    expect(q.eq).toHaveBeenCalledWith("status", "approved");
    expect(q.select.mock.calls[0][0]).not.toMatch(/author/);
  });
});

describe("POST /api/rooms/pages", () => {
  const page = { sectionId: "s1", title: "On debt", body: "Lydgate's debts…", quote: "a quote", locator: "p. 112" };
  const liveSection = { data: { id: "s1", label: "Book One", rooms: { title: "Middlemarch", status: "live" } } };

  it("is rate-limited per IP", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: { data: [{ allowed: false, hits: 6, retry_after: 60 }] } },
    });
    expect((await postPage(jsonRequest(`${BASE}/pages`, page))).status).toBe(429);
  });


  it("works signed out: the page waits for review and the admin is told", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow },
      tables: { room_sections: liveSection, room_pages: { data: { id: "p9" } } },
    });
    const res = await postPage(jsonRequest(`${BASE}/pages`, page));
    expect(res.status).toBe(201);
    expectNoAuthor(await res.json());
    expect(holder.current.query("room_pages")!.insert).toHaveBeenCalledWith({
      section_id: "s1",
      title: "On debt",
      body: "Lydgate's debts…",
      quote: "a quote",
      locator: "p. 112",
    });
    expect(holder.current.query("room_page_authors")).toBeUndefined();
    expect(notifyAdminNewRoomPage).toHaveBeenCalledWith({ room: "Middlemarch", section: "Book One" });
  });

  it.each([
    ["missing", undefined],
    ["blank", "   "],
  ])("accepts a page whose title is %s, storing it as null", async (_label, title) => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow },
      tables: { room_sections: liveSection, room_pages: { data: { id: "p9" } } },
    });
    const res = await postPage(jsonRequest(`${BASE}/pages`, { ...page, title }));
    expect(res.status).toBe(201);
    expect(holder.current.query("room_pages")!.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: null, body: "Lydgate's debts…" })
    );
  });

  it("keeps a private author link when the writer is signed in", async () => {
    profileHolder.current = profile;
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow },
      tables: { room_sections: liveSection, room_pages: { data: { id: "p9" } }, room_page_authors: { data: null } },
    });
    const res = await postPage(jsonRequest(`${BASE}/pages`, page));
    expect(res.status).toBe(201);
    expectNoAuthor(await res.json());
    expect(holder.current.query("room_page_authors")!.insert).toHaveBeenCalledWith({ page_id: "p9", profile_id: "prof-1" });
  });

  it.each([
    ["no body", { ...page, body: "   " }],
    ["a 201-character title", { ...page, title: "x".repeat(201) }],
    ["a 301-character quote", { ...page, quote: "x".repeat(301) }],
    ["a 41-character locator", { ...page, locator: "x".repeat(41) }],
    ["a 10,001-character body", { ...page, body: "x".repeat(10001) }],
  ])("refuses %s", async (_label, body) => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
    expect((await postPage(jsonRequest(`${BASE}/pages`, body))).status).toBe(400);
  });

  it("refuses a page for a removed room", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow },
      tables: { room_sections: { data: { id: "s1", label: "x", rooms: { title: "t", status: "removed" } } } },
    });
    expect((await postPage(jsonRequest(`${BASE}/pages`, page))).status).toBe(404);
    expect(holder.current.query("room_pages")).toBeUndefined();
  });
});

describe("margins", () => {
  const openPage = { data: { id: "p1", status: "approved", room_sections: { rooms: { status: "live" } } } };

  it("GET returns a page's margins, with no author", async () => {
    const margins = [{ id: "m1", body: "yes", created_at: "x", parent_id: null }];
    holder.current = createMockSupabase({ tables: { room_margins: { data: margins } } });
    const body = await (await getMargins(getRequest(`${BASE}/margins?page=p1`))).json();
    expect(body).toEqual({ margins });
    expectNoAuthor(body);
  });


  it("POST works signed out and publishes at once", async () => {
    const margin = { id: "m2", body: "hi", created_at: "x", parent_id: null };
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow },
      tables: { room_pages: openPage, room_margins: { data: margin } },
    });
    const res = await postMargin(jsonRequest(`${BASE}/margins`, { pageId: "p1", body: " hi " }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ margin });
    expectNoAuthor(body);
  });

  it("POST attaches a reply-to-a-reply to the top-level margin", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow },
      tables: {
        room_pages: openPage,
        room_margins: [
          { data: { id: "m-reply", page_id: "p1", parent_id: "m-top" } },
          { data: { id: "m3", body: "deeper", created_at: "x", parent_id: "m-top" } },
        ],
      },
    });
    await postMargin(jsonRequest(`${BASE}/margins`, { pageId: "p1", body: "deeper", parentId: "m-reply" }));
    expect(holder.current.query("room_margins", 1)!.insert).toHaveBeenCalledWith({
      page_id: "p1",
      parent_id: "m-top",
      body: "deeper",
    });
  });

  it("POST refuses a parent from another page", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow },
      tables: { room_pages: openPage, room_margins: { data: { id: "m9", page_id: "other", parent_id: null } } },
    });
    const res = await postMargin(jsonRequest(`${BASE}/margins`, { pageId: "p1", body: "x", parentId: "m9" }));
    expect(res.status).toBe(400);
  });

  it("POST refuses a margin on a page that isn't approved", async () => {
    holder.current = createMockSupabase({
      rpcs: { rate_limit_hit: allow },
      tables: { room_pages: { data: { id: "p1", status: "pending", room_sections: { rooms: { status: "live" } } } } },
    });
    expect((await postMargin(jsonRequest(`${BASE}/margins`, { pageId: "p1", body: "x" }))).status).toBe(404);
  });

  it("POST refuses an overlong margin", async () => {
    holder.current = createMockSupabase({ rpcs: { rate_limit_hit: allow } });
    expect((await postMargin(jsonRequest(`${BASE}/margins`, { pageId: "p1", body: "x".repeat(2001) }))).status).toBe(400);
  });
});
