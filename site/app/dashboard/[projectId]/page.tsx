import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
// Re-fetch every 5 seconds while user is on the page so they see status
// transition from generating → ready without manual refresh.
export const revalidate = 5;

const TEMPLATE_URL = "https://stacklense.com/aws/connect-stacklense.yaml";

function buildQuickCreateUrl(token: string) {
  const params = new URLSearchParams({
    templateURL: TEMPLATE_URL,
    stackName: "StackLenseConnect",
    param_WebhookToken: token,
  });
  return `https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/quickcreate?${params.toString()}`;
}

type Project = {
  id: string;
  name: string;
  description: string | null;
  connected_at: string;
  git_host: string | null;
  git_repo_full_name: string | null;
  git_webhook_id: number | null;
  ecr_aws_account_id: string | null;
  ecr_repo_name: string | null;
  ecr_webhook_token: string | null;
  blueprint: BlueprintShape | null;
  blueprint_status: "pending" | "generating" | "ready" | "failed";
  blueprint_generated_at: string | null;
  blueprint_error: string | null;
};

type BlueprintShape = {
  summary?: string;
  services?: Array<{
    name: string;
    kind: string;
    description: string;
    evidence: string;
  }>;
  data_flows?: Array<{ from: string; to: string; what: string }>;
  decisions?: Array<{
    title: string;
    category: string;
    risk: string;
    rationale: string;
    evidence: string;
  }>;
  security_flags?: Array<{
    title: string;
    severity: string;
    description: string;
    remediation: string;
  }>;
  open_questions?: string[];
};

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
      "id, name, description, connected_at, git_host, git_repo_full_name, git_webhook_id, ecr_aws_account_id, ecr_repo_name, ecr_webhook_token, blueprint, blueprint_status, blueprint_generated_at, blueprint_error"
    )
    .eq("id", projectId)
    .single<Project>();

  if (error || !project) notFound();

  const { data: deploys } = await supabase
    .from("deploys")
    .select("id, image_tag, deploy_note, created_at, source_type")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const hasGitHub = !!project.git_repo_full_name;
  const hasEcr = !!project.ecr_webhook_token;
  const cfnUrl = project.ecr_webhook_token
    ? buildQuickCreateUrl(project.ecr_webhook_token)
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

      <BlueprintStatusBanner project={project} cfnUrl={cfnUrl} />

      <section className="project-section">
        <h2 className="dash-h2">Connection</h2>
        <dl className="project-meta">
          {hasGitHub && (
            <>
              <dt>GitHub repo</dt>
              <dd>
                <a
                  href={`https://github.com/${project.git_repo_full_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {project.git_repo_full_name}
                </a>
                {project.git_webhook_id && (
                  <span className="project-meta-pill">webhook installed</span>
                )}
              </dd>
            </>
          )}
          {hasEcr && (
            <>
              <dt>AWS ECR</dt>
              <dd>
                {project.ecr_aws_account_id && (
                  <code className="aws-code">
                    {project.ecr_aws_account_id}
                  </code>
                )}
                {project.ecr_repo_name && (
                  <code className="aws-code" style={{ marginLeft: 8 }}>
                    {project.ecr_repo_name}
                  </code>
                )}
                {!project.ecr_aws_account_id && !project.ecr_repo_name && (
                  <span style={{ color: "var(--ink3)" }}>
                    Watching all ECR repos
                  </span>
                )}
              </dd>
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
        <h2 className="dash-h2">Blueprint</h2>
        <BlueprintView project={project} />
      </section>

      <section className="project-section">
        <h2 className="dash-h2">Recent deploys</h2>
        {!deploys || deploys.length === 0 ? (
          <div className="project-empty">
            <p>
              No deploy events recorded yet. Once you push to your repo (GitHub)
              or push an image (ECR), this list will populate.
            </p>
          </div>
        ) : (
          <ul className="deploy-list">
            {deploys.map((d) => (
              <li key={d.id} className="deploy-item">
                <div className="deploy-tag">
                  <span className={`deploy-source deploy-source-${d.source_type}`}>
                    {d.source_type}
                  </span>
                  {d.image_tag ?? "(no tag)"}
                </div>
                <div className="deploy-note">{d.deploy_note ?? ""}</div>
                <div className="deploy-time">
                  {new Date(d.created_at).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function BlueprintStatusBanner({
  project,
  cfnUrl,
}: {
  project: Project;
  cfnUrl: string | null;
}) {
  const status = project.blueprint_status;
  const hasEcrButNoEvents =
    !!project.ecr_webhook_token &&
    !project.git_repo_full_name &&
    status === "pending";

  if (hasEcrButNoEvents && cfnUrl) {
    return (
      <div className="bp-banner bp-banner-action">
        <div className="bp-banner-title">One step left — install the rule</div>
        <p className="bp-banner-desc">
          Click below to open AWS CloudFormation with everything pre-filled.
          After you click <strong>Create stack</strong>, the next ECR push
          will trigger your first blueprint here automatically.
        </p>
        <a
          href={cfnUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="aws-action-btn"
        >
          Open CloudFormation in AWS →
        </a>
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="bp-banner bp-banner-generating">
        <div className="bp-banner-title">
          <span className="bp-spinner" /> Blueprint generating…
        </div>
        <p className="bp-banner-desc">
          Claude is analyzing your sources. This page auto-refreshes every few
          seconds.
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="bp-banner bp-banner-failed">
        <div className="bp-banner-title">Blueprint generation failed</div>
        <p className="bp-banner-desc">
          {project.blueprint_error ??
            "Unknown error. We'll retry on your next push."}
        </p>
      </div>
    );
  }

  return null;
}

function BlueprintView({ project }: { project: Project }) {
  if (!project.blueprint) {
    return (
      <div className="project-empty">
        <p>
          {project.blueprint_status === "generating"
            ? "Generating now — your blueprint will appear here."
            : project.blueprint_status === "failed"
            ? "Blueprint failed. The error is in the banner above."
            : "Blueprint will be generated when your first deploy event arrives, or right after you connect a GitHub repo."}
        </p>
      </div>
    );
  }

  const bp = project.blueprint;

  return (
    <div className="bp-content">
      {bp.summary && <p className="bp-summary">{bp.summary}</p>}

      {bp.services && bp.services.length > 0 && (
        <div className="bp-block">
          <h3 className="bp-h3">Services</h3>
          <ul className="bp-list">
            {bp.services.map((s, i) => (
              <li key={i} className="bp-item">
                <div className="bp-item-head">
                  <span className="bp-item-name">{s.name}</span>
                  <span className="bp-item-tag">{s.kind}</span>
                </div>
                <p className="bp-item-desc">{s.description}</p>
                {s.evidence && (
                  <p className="bp-evidence">Evidence: {s.evidence}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {bp.data_flows && bp.data_flows.length > 0 && (
        <div className="bp-block">
          <h3 className="bp-h3">Data flows</h3>
          <ul className="bp-list">
            {bp.data_flows.map((f, i) => (
              <li key={i} className="bp-item">
                <code className="bp-flow">
                  {f.from} → {f.to}
                </code>
                <p className="bp-item-desc">{f.what}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bp.decisions && bp.decisions.length > 0 && (
        <div className="bp-block">
          <h3 className="bp-h3">Decisions</h3>
          <ul className="bp-list">
            {bp.decisions.map((d, i) => (
              <li key={i} className="bp-item">
                <div className="bp-item-head">
                  <span className="bp-item-name">{d.title}</span>
                  <span className={`bp-risk bp-risk-${d.risk}`}>{d.risk}</span>
                  <span className="bp-item-tag">{d.category}</span>
                </div>
                <p className="bp-item-desc">{d.rationale}</p>
                {d.evidence && (
                  <p className="bp-evidence">Evidence: {d.evidence}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {bp.security_flags && bp.security_flags.length > 0 && (
        <div className="bp-block">
          <h3 className="bp-h3">Security flags</h3>
          <ul className="bp-list">
            {bp.security_flags.map((f, i) => (
              <li key={i} className="bp-item">
                <div className="bp-item-head">
                  <span className="bp-item-name">{f.title}</span>
                  <span className={`bp-risk bp-risk-${f.severity}`}>
                    {f.severity}
                  </span>
                </div>
                <p className="bp-item-desc">{f.description}</p>
                {f.remediation && (
                  <p className="bp-evidence">Fix: {f.remediation}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {bp.open_questions && bp.open_questions.length > 0 && (
        <div className="bp-block">
          <h3 className="bp-h3">Open questions</h3>
          <ul className="bp-list">
            {bp.open_questions.map((q, i) => (
              <li key={i} className="bp-item bp-item-question">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {project.blueprint_generated_at && (
        <p className="bp-foot">
          Generated{" "}
          {new Date(project.blueprint_generated_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
    </div>
  );
}
