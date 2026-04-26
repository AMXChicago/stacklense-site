import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  updateProject,
  regenerateBlueprint,
  sendTestEvent,
} from "./actions";
import { DeleteProjectButton } from "./DeleteProjectButton";

export const dynamic = "force-dynamic";
// Re-fetch every 5 seconds while user is on the page so they see status
// transition from generating → ready without manual refresh.
export const revalidate = 5;

/**
 * AWS CloudFormation Quick Create requires `templateURL` and that URL must
 * point to an S3 bucket. We host the template in a public S3 bucket; the
 * URL lives in NEXT_PUBLIC_CFN_TEMPLATE_URL so we can swap buckets later
 * (e.g. when StackLense gets its own dedicated AWS account) without code
 * changes.
 */
const CFN_TEMPLATE_URL =
  process.env.NEXT_PUBLIC_CFN_TEMPLATE_URL ||
  "https://stacklense-cfn-templates.s3.amazonaws.com/connect-stacklense.yaml";

function buildQuickCreateUrl(token: string) {
  const params = new URLSearchParams({
    templateURL: CFN_TEMPLATE_URL,
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
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    regenerating?: string;
    test_sent?: string;
  }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const savedFlash = !!sp.saved;
  const regeneratingFlash = !!sp.regenerating;
  const testSentFlash = !!sp.test_sent;
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

      {regeneratingFlash && (
        <div className="dash-flash">⟳ Rebuilding your blueprint…</div>
      )}
      {testSentFlash && (
        <div className="dash-flash">
          ✓ Test update sent. Refresh in a few seconds to see it in your
          history and your blueprint rebuild.
        </div>
      )}

      <ProjectStatusPanel
        project={project}
        deploys={deploys ?? []}
        cfnUrl={cfnUrl}
      />

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
        <h2 className="dash-h2">Recent updates</h2>
        {!deploys || deploys.length === 0 ? (
          <div className="project-empty">
            <p>
              No updates yet. We&rsquo;ll show them here as you ship new
              versions of your project.
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

      <section className="project-section">
        <h2 className="dash-h2">Settings</h2>

        {errorMsg && <div className="login-error">{errorMsg}</div>}
        {savedFlash && (
          <div className="settings-flash">✓ Changes saved.</div>
        )}

        <form action={updateProject} className="settings-card">
          <input type="hidden" name="project_id" value={project.id} />

          <label className="form-label" htmlFor="settings_name">
            Project name
          </label>
          <input
            id="settings_name"
            name="name"
            type="text"
            required
            defaultValue={project.name}
            className="login-input"
          />

          <label className="form-label" htmlFor="settings_description">
            Description
          </label>
          <input
            id="settings_description"
            name="description"
            type="text"
            defaultValue={project.description ?? ""}
            placeholder="What does this project do?"
            className="login-input"
          />

          <button type="submit" className="login-btn settings-save">
            Save changes
          </button>
        </form>

        <div className="settings-card settings-danger">
          <div className="settings-danger-title">Danger zone</div>
          <p className="settings-danger-desc">
            Deleting removes the project, all deploy history, and the
            generated blueprint. {hasGitHub && "Your GitHub webhook is also removed (best-effort)."} {hasEcr && "Your AWS CloudFormation stack stays in place; delete it manually if you no longer want events to fire."} This cannot be undone.
          </p>
          <DeleteProjectButton
            projectId={project.id}
            projectName={project.name}
            hasGitHub={hasGitHub}
            hasEcr={hasEcr}
          />
        </div>
      </section>
    </>
  );
}

type StageStatus = "done" | "active" | "pending" | "failed";

type Stage = {
  key: "created" | "connected" | "live";
  label: string;
  status: StageStatus;
};

function computeStages(
  project: Project,
  deploys: Array<{ id: string }>
): Stage[] {
  const isGitHub = !!project.git_repo_full_name;

  // "Connected" means StackLense is verified to be receiving signal from
  // the project. For GitHub that's webhook-installed (we did it ourselves
  // via API). For AWS we can't check directly, so we infer from any event
  // having arrived.
  const connected = isGitHub
    ? !!project.git_webhook_id
    : deploys.length > 0;
  const blueprintReady = project.blueprint_status === "ready";
  const blueprintFailed = project.blueprint_status === "failed";

  const raw = [
    { key: "created" as const, label: "Created", done: true, failed: false },
    { key: "connected" as const, label: "Connected", done: connected, failed: false },
    {
      key: "live" as const,
      label: "Live blueprint",
      done: blueprintReady,
      failed: blueprintFailed,
    },
  ];

  let foundActive = false;
  return raw.map((s): Stage => {
    let status: StageStatus;
    if (s.failed) status = "failed";
    else if (s.done) status = "done";
    else if (!foundActive) {
      status = "active";
      foundActive = true;
    } else status = "pending";
    return { key: s.key, label: s.label, status };
  });
}

function ProjectStatusPanel({
  project,
  deploys,
  cfnUrl,
}: {
  project: Project;
  deploys: Array<{ id: string; created_at: string }>;
  cfnUrl: string | null;
}) {
  const stages = computeStages(project, deploys);
  const active = stages.find((s) => s.status === "active");
  const failed = stages.find((s) => s.status === "failed");
  const allDone = stages.every((s) => s.status === "done");
  const isGitHub = !!project.git_repo_full_name;
  const isEcr = !!project.ecr_webhook_token;
  const lastDeploy = deploys[0];

  return (
    <section className="project-section">
      <h2 className="dash-h2">Status</h2>
      <div className="status-card">
        <ol className="status-timeline status-timeline-3">
          {stages.map((s, i) => (
            <li
              key={s.key}
              className={`status-step status-step-${s.status}`}
              data-step={i + 1}
            >
              <div className="status-step-dot">
                {s.status === "done" && "✓"}
                {s.status === "failed" && "!"}
                {(s.status === "active" || s.status === "pending") && i + 1}
              </div>
              <div className="status-step-label">{s.label}</div>
            </li>
          ))}
        </ol>

        <div className="status-action">
          {failed && (
            <>
              <p className="status-action-text status-action-failed">
                <strong>Couldn&rsquo;t build the blueprint.</strong>{" "}
                {project.blueprint_error ?? "Unknown error."}
              </p>
              <div className="status-buttons">
                <RegenerateButton projectId={project.id} />
              </div>
            </>
          )}

          {!failed && active?.key === "connected" && isEcr && (
            <>
              <p className="status-action-text">
                Open AWS to finish setup. This adds a small piece to your AWS
                account so we know when you ship a new version. Once you do —
                or click the test button — your blueprint goes live.
              </p>
              <div className="status-buttons">
                {cfnUrl && (
                  <a
                    href={cfnUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aws-action-btn"
                  >
                    Open AWS setup →
                  </a>
                )}
                <Link
                  href={`/dashboard/${project.id}/setup-manual`}
                  className="bp-banner-link"
                >
                  Set up manually →
                </Link>
                <TestEventButton projectId={project.id} />
              </div>
            </>
          )}

          {!failed &&
            active?.key === "live" &&
            project.blueprint_status === "generating" && (
              <p className="status-action-text">
                <span className="bp-spinner" /> Building your blueprint right
                now — usually 15–30 seconds. This page refreshes automatically.
              </p>
            )}

          {!failed &&
            active?.key === "live" &&
            project.blueprint_status !== "generating" && (
              <>
                <p className="status-action-text">
                  {isGitHub
                    ? "Setup is connected. Push code to your repo and your first blueprint will build automatically."
                    : "Setup is connected. Ship a new version of your app — or click the test button to fake an update and watch your blueprint build."}
                </p>
                <div className="status-buttons">
                  {isGitHub && project.git_repo_full_name && (
                    <a
                      href={`https://github.com/${project.git_repo_full_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bp-banner-link"
                    >
                      Open repo →
                    </a>
                  )}
                  {isEcr && <TestEventButton projectId={project.id} />}
                </div>
              </>
            )}

          {allDone && (
            <>
              <p className="status-action-text">
                ✓ Your blueprint is live and will rebuild every time you
                ship something new.{" "}
                {lastDeploy &&
                  `Last update ${formatRelative(lastDeploy.created_at)}.`}
              </p>
              <div className="status-buttons">
                <RegenerateButton projectId={project.id} />
                {isEcr && <TestEventButton projectId={project.id} />}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function RegenerateButton({ projectId }: { projectId: string }) {
  return (
    <form action={regenerateBlueprint}>
      <input type="hidden" name="project_id" value={projectId} />
      <button type="submit" className="status-secondary-btn">
        Regenerate blueprint
      </button>
    </form>
  );
}

function TestEventButton({ projectId }: { projectId: string }) {
  return (
    <form action={sendTestEvent}>
      <input type="hidden" name="project_id" value={projectId} />
      <button type="submit" className="status-secondary-btn">
        Send a test update
      </button>
    </form>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

function BlueprintView({ project }: { project: Project }) {
  if (!project.blueprint) {
    return (
      <div className="project-empty">
        <p>
          {project.blueprint_status === "generating"
            ? "Generating now — your blueprint will appear here."
            : project.blueprint_status === "failed"
            ? "Blueprint generation failed. See the Status panel above for the error and a regenerate button."
            : "Blueprint will be generated when your first event arrives. See the Status panel above to track progress."}
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
