import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/**
 * Workspace layout — full-bleed shell for the dashboard. No top nav,
 * no centered max-width container. Auth check only; the page owns
 * everything visible to the customer.
 *
 * Per spec: "Single screen, no routing." The dashboard is one URL
 * (/dashboard/[projectId]) with five regions managed by client
 * state. This layout's job is auth + nothing else.
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
  return <>{children}</>;
}
