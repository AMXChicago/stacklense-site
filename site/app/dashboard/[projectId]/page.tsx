import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, name, description, aws_account_id, ecr_repo, blueprint_s3_bucket, connected_at"
    )
    .eq("id", projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  const { data: deploys } = await supabase
    .from("deploys")
    .select("id, image_tag, deploy_note, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const isGitHub = project.ecr_repo?.startsWith("github:");
  const githubFullName = isGitHub
    ? project.ecr_repo!.replace(/^github:/, "")
    : null;

  return (
    <>
      <div className="dash-greeting">
        <Link href="/dashboard" className="connect-back">
          ← All projects
        </Link>
        <div className="dash-section-label">Project</div>
        <h1 className="dash-h1">{project.name}</h1>
        {project.description && (
          <p className="dash-sub">{project.description}</p>
        )}
      </div>

      <section className="project-section">
        <h2 className="dash-h2">Connection</h2>
        <dl className="project-meta">
          {githubFullName && (
            <>
              <dt>GitHub repo</dt>
              <dd>
                <a
                  href={`https://github.com/${githubFullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {githubFullName}
                </a>
              </dd>
            </>
          )}
          {project.aws_account_id && (
            <>
              <dt>AWS account</dt>
              <dd>
                <code className="aws-code">{project.aws_account_id}</code>
              </dd>
              {!isGitHub && project.ecr_repo && (
                <>
                  <dt>Role ARN</dt>
                  <dd>
                    <code className="aws-code">{project.ecr_repo}</code>
                  </dd>
                </>
              )}
            </>
          )}
          <dt>Connected</dt>
          <dd>
            {new Date(project.connected_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </dd>
        </dl>
      </section>

      <section className="project-section">
        <h2 className="dash-h2">Recent deploys</h2>
        {!deploys || deploys.length === 0 ? (
          <div className="project-empty">
            <p>
              No deploys recorded yet. Once you push to ECR (AWS) or push to
              your repo (GitHub), this list will populate automatically.
            </p>
          </div>
        ) : (
          <ul className="deploy-list">
            {deploys.map((d) => (
              <li key={d.id} className="deploy-item">
                <div className="deploy-tag">
                  {d.image_tag ?? "(no tag)"}
                </div>
                {d.deploy_note && (
                  <div className="deploy-note">{d.deploy_note}</div>
                )}
                <div className="deploy-time">
                  {new Date(d.created_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="project-section">
        <h2 className="dash-h2">Blueprint</h2>
        <div className="project-empty">
          <p>
            Living blueprint generation is wired up in the next step. As soon
            as your first deploy event arrives, this section will fill in with
            services, decisions, security flags, and data flows.
          </p>
        </div>
      </section>
    </>
  );
}
