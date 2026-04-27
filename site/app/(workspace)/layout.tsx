import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/**
 * Layout for the project workspace.
 *
 * The workspace is a full-viewport application shell with its own
 * navigation rail and main canvas. Unlike the home route group, this
 * layout deliberately renders NO top nav — the project page draws
 * its own UI from edge to edge. Auth still happens here (redirect
 * to /login if no session), but no chrome is added; the page itself
 * is responsible for everything visible to the customer.
 *
 * This is the proper Next.js way to give a sub-tree of the URL
 * (`/dashboard/[projectId]`) a different shell from its siblings
 * (`/dashboard`, `/dashboard/connect`). Route groups in parens
 * don't affect the URL but let layouts diverge.
 */
export default async function WorkspaceLayout({
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
  return <div className="ws-root">{children}</div>;
}
