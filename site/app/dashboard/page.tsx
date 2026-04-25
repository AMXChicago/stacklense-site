import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description, connected_at")
    .order("connected_at", { ascending: false });

  return (
    <>
      <div className="dash-greeting">
        <div className="dash-section-label">Dashboard</div>
        <h1 className="dash-h1">Welcome back</h1>
        <p className="dash-sub">{user?.email}</p>
      </div>

      {!projects || projects.length === 0 ? (
        <div className="dash-empty">
          <div className="dash-empty-icon">🗺️</div>
          <h2 className="dash-empty-h2">No projects connected yet</h2>
          <p className="dash-empty-p">
            Connect your first project to start generating a living
            architecture blueprint. Every deploy will auto-update it.
          </p>
          <Link href="/dashboard/connect" className="dash-empty-cta">
            Connect a project →
          </Link>
        </div>
      ) : (
        <>
          <div className="dash-projects-header">
            <h2 className="dash-h2">Your projects</h2>
            <Link href="/dashboard/connect" className="dash-cta">
              Connect another →
            </Link>
          </div>
          <ul className="dash-projects">
            {projects.map((p) => (
              <li key={p.id} className="dash-project">
                <Link href={`/dashboard/${p.id}`}>
                  <div className="dash-project-name">{p.name}</div>
                  {p.description && (
                    <div className="dash-project-desc">{p.description}</div>
                  )}
                  <div className="dash-project-meta">
                    Connected{" "}
                    {new Date(p.connected_at).toLocaleDateString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
