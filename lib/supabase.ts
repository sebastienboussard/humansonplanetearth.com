import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

// Public client — safe to use in browser and server components
export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client — server-side only, bypasses RLS
// Only import this in API routes, never in client components
let adminClient: ReturnType<typeof createClient> | null = null;
export function getAdminClient() {
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY!);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return adminClient as any;
}
