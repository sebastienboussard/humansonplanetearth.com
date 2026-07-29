import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client with cookie-backed auth session.
// Use only in client components (login form, session detection).
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );
}
