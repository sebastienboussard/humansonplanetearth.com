import { createServerSupabase } from "@/lib/supabase-server";
import AccountLogin from "./AccountLogin";
import AccountDashboard from "./AccountDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account — Humans on Planet Earth",
};

export default async function AccountPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-normal mb-2" style={{ color: "var(--forest)" }}>
        {user ? "Your Account" : "Sign In"}
      </h1>
      <p
        className="text-sm mb-10"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        {user
          ? "Anonymous profile — your email is used only for the notifications you choose."
          : "Optional. An account is only for email notifications — submitting and commenting never require one."}
      </p>

      {user ? <AccountDashboard /> : <AccountLogin />}
    </div>
  );
}
