import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="dash-shell">
      <nav className="dash-nav">
        <Link href="/dashboard" className="nav-logo">
          <div className="nav-logo-mark"></div>
          StackLense
        </Link>
        <div className="nav-right">
          <span className="dash-nav-user">{user?.email ?? ""}</span>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="dash-nav-signout">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="dash-main">{children}</main>
    </div>
  );
}
