// Global test setup — runs before every test file (see vitest.config.ts).
// Forces deterministic env values so tests never touch real Supabase creds.

process.env.TZ = "UTC";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "test-publishable-key";
process.env.SUPABASE_SECRET_KEY = "test-secret-key";
process.env.ADMIN_PASSWORD = "test-admin-password";
