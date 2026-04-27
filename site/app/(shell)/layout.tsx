import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/**
 * Shell layout — auth-gated app frame for routes that aren't the
 * full-bleed workspace. Holds the project list and the connect
 * flow.
 *
 * The visible chrome (top bar with brand + sign out) is intentionally
 * minimal here. Real chrome arrives when features/topbar lands; for
 * now this just shows a placeholder header so the existence of the
 * layout is visible.
 */
export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <Link
          href="/dashboard"
          className="font-mono text-sm font-medium text-ink"
        >
          StackLense
        </Link>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-ink3">{user.email}</span>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-border2 bg-bg2 px-3 py-1.5 font-mono text-xs text-ink2 hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
