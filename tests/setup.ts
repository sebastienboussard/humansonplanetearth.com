// Global test setup — runs before every test file (see vitest.config.ts).
// Forces deterministic env values so tests never touch real Supabase creds.

process.env.TZ = "UTC";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "test-publishable-key";
process.env.SUPABASE_SECRET_KEY = "test-secret-key";
process.env.ADMIN_PASSWORD = "test-admin-password";
process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
process.env.CRON_SECRET = "test-cron-secret";
process.env.NEXT_PUBLIC_SITE_URL = "https://test.humansonplanetearth.com";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.NOTIFY_FROM_EMAIL = "HOPE <notify@test.example>";
