import { vi } from "vitest";

/**
 * Mocks for the user-auth layer, mirroring the supabase-mock holder pattern.
 *
 * `supabaseServerModuleMock` replaces `@/lib/supabase-server` — set
 * `userHolder.current` to a fake auth user (or null for anonymous) per test.
 *
 * `profileModuleMock` replaces `@/lib/profile` wholesale for routes where
 * profile resolution is not under test — set `profileHolder.current` to the
 * profile the session should resolve to (or null for anonymous).
 */

export type FakeUser = { id: string; email: string };
export type UserHolder = { current: FakeUser | null };

export function supabaseServerModuleMock(holder: UserHolder) {
  return {
    createServerSupabase: async () => ({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: holder.current }, error: null })),
        signOut: vi.fn(async () => ({ error: null })),
        verifyOtp: vi.fn(async () => ({ error: null })),
      },
    }),
  };
}

export type FakeProfile = { id: string; user_id: string; email: string };
export type ProfileHolder = { current: FakeProfile | null };

export function profileModuleMock(holder: ProfileHolder) {
  return {
    DEFAULT_PREFS: {
      new_word: true,
      deadline_reminders: true,
      paper_comments: true,
      comment_replies: true,
    },
    getSessionUser: vi.fn(async () =>
      holder.current ? { id: holder.current.user_id, email: holder.current.email } : null
    ),
    ensureProfile: vi.fn(async () => holder.current),
  };
}
