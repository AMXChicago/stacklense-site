import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { maybeAutoVerify } from "@/lib/auto-verify";
import {
  updateProject,
  regenerateBlueprint,
  sendTestEvent,
} from "./actions";
import { DeleteProjectButton } from "./DeleteProjectButton";
import { AutoRefresh } from "./AutoRefresh";
import { BlueprintDiagram } from "./BlueprintDiagram";
import { BlueprintInventory } from "./BlueprintInventory";
import { VendorLogo } from "./VendorLogo";
import { ExportButtons } from "./ExportButtons";
import { AwsConnectionPanel } from "./AwsConnectionPanel";
import { ProjectWorkspaceClient } from "./ProjectWorkspaceClient";
import { buildQuickCreateUrl } from "@/lib/cfn";
import { summarizeDiscoveryErrors } from "@/lib/cfn";

export const dynamic = "force-dynamic";
// Re-fetch every 5 seconds while user is on the page so they see status
// transition from generating → ready without manual refresh.
export const revalidate = 5;

type Project = {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  connected_at: string;
  git_host: string | null;
  git_repo_full_name: string | null;
  git_repo_id: number | null;
  git_webhook_id: number | null;
  git_webhook_secret: string | null;
  ecr_aws_account_id: string | null;
  ecr_repo_name: string | null;
  ecr_webhook_token: string | null;
  blueprint: BlueprintShape | null;
  blueprint_status: "pending" | "generating" | "ready" | "failed";
  blueprint_generated_at: string | null;
  blueprint_error: string | null;
  blueprint_progress: BlueprintProgress | null;
  auto_verify_at: string | null;
  aws_role_verified_at: string | null;
  aws_role_last_checked_at: string | null;
  aws_region: string | null;
  cfn_template_version: string | null;
  discovery_snapshot: Record<string, unknown> | null;
  discovery_at: string | null;
};

type BlueprintProgress = {
  stage:
    | "starting"
    | "reading_sources"
    | "asking_claude"
    | "finalizing";
  started_at: string;
};

type BlueprintComponent = {
  id: string;
  name: string;
  vendor?: string;
  description: string;
  evidence?: string;
  console_url?: string;
};

type BlueprintCategory = {
  key: string;
  label: string;
  components: BlueprintComponent[];
};

type BlueprintShape = {
  summary?: string;
  categories?: BlueprintCategory[];
  connections?: Array<{ from: string; to: string; label?: string }>;
  decisions?: Array<{
    title: string;
    category: string;
    risk: string;
    rationale: string;
    evidence?: string;
  }>;
  risks?: Array<{
    title: string;
    severity: string;
    description: string;
    remediation?: string;
  }>;
  // Legacy shape — kept for backward compat during transition
  services?: unknown;
  data_flows?: unknown;
  security_flags?: unknown;
  open_questions?: unknown;
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
    conn_test?: string;
    conn_msg?: string;
  }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const savedFlash = !!sp.saved;
  const regeneratingFlash = !!sp.regenerating;
  const testSentFlash = !!sp.test_sent;
  const connTestResult: "ok" | "fail" | null =
    sp.conn_test === "ok"
      ? "ok"
      : sp.conn_test === "fail"
      ? "fail"
      : null;
  const connTestMessage = sp.conn_msg ? decodeURIComponent(sp.conn_msg) : null;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Need the user's email for the bottom-right account menu in the
  // workspace shell.
  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData?.user?.email ?? "";

  const SELECT_COLS =
    "id, name, description, notes, connected_at, git_host, git_repo_full_name, git_repo_id, git_webhook_id, git_webhook_secret, ecr_aws_account_id, ecr_repo_name, ecr_webhook_token, blueprint, blueprint_status, blueprint_generated_at, blueprint_error, blueprint_progress, auto_verify_at, aws_role_verified_at, aws_role_last_checked_at, aws_region, cfn_template_version, discovery_snapshot, discovery_at";

  const initialFetch = await supabase
    .from("projects")
    .select(SELECT_COLS)
    .eq("id", projectId)
    .single<Project>();

  if (initialFetch.error || !initialFetch.data) notFound();
  let project: Project = initialFetch.data;

  let { data: deploys } = await supabase
    .from("deploys")
    .select("id, image_tag, deploy_note, created_at, source_type")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Auto-verify on first visit when no events have arrived yet.
  // For AWS-connected projects: try AssumeRole to actively verify the
  // CFN stack is up. If it succeeds, we mark the project verified and
  // kick off blueprint generation.
  const verifyResult = await maybeAutoVerify(project);
  if (verifyResult.ran) {
    const refreshed = await supabase
      .from("projects")
      .select(SELECT_COLS)
      .eq("id", projectId)
      .single<Project>();
    if (refreshed.data) project = refreshed.data;
    const refreshedDeploys = await supabase
      .from("deploys")
      .select("id, image_tag, deploy_note, created_at, source_type")
      .eq("project_id", project!.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (refreshedDeploys.data) deploys = refreshedDeploys.data;
  }

  if (!project) notFound();

  const hasGitHub = !!project.git_repo_full_name;
  const hasEcr = !!project.ecr_webhook_token;
  const cfnUrl = project.ecr_webhook_token
    ? buildQuickCreateUrl({
        webhookToken: project.ecr_webhook_token,
        region: project.aws_region ?? undefined,
      })
    : null;
  // The discovery snapshot stores errors[] in a typed shape; pull them
  // out for the connection panel without leaking the full snapshot type.
  const discoveryErrors =
    (
      project.discovery_snapshot as
        | { errors?: Array<{ source: string; message: string }> }
        | null
    )?.errors ?? null;

  const bp = project.blueprint;
  const summary = bp?.summary ?? project.description;
  const isLegacyShape =
    bp && !bp.categories && (bp.services || bp.security_flags || bp.data_flows);
  const categories = bp?.categories ?? [];
  const connections = bp?.connections ?? [];
  const decisions = bp?.decisions ?? [];
  const risks = bp?.risks ?? [];

  // Workspace status chip ("● Live" / "● Generating…" / etc.).
  const statusKindMap: Record<
    Project["blueprint_status"],
    { kind: "ok" | "running" | "neutral" | "err"; label: string }
  > = {
    pending: { kind: "neutral", label: "Pending" },
    generating: { kind: "running", label: "Generating…" },
    ready: { kind: "ok", label: "Live" },
    failed: { kind: "err", label: "Failed" },
  };
  const status = statusKindMap[project.blueprint_status];

  // The AWS rail item gets a warning dot when there's a permission
  // gap or the role is no longer assumable.
  const awsErrSummary = summarizeDiscoveryErrors(discoveryErrors);
  const awsNeedsAttention =
    hasEcr &&
    (awsErrSummary.hasPermissionGap ||
      (project.aws_role_verified_at === null &&
        project.aws_role_last_checked_at !== null));

  const flashes =
    regeneratingFlash || testSentFlash ? (
      <>
        {regeneratingFlash && (
          <div className="dash-flash">⟳ Rebuilding your blueprint…</div>
        )}
        {testSentFlash && (
          <div className="dash-flash">
            ✓ Test update sent. Watching for the result.
          </div>
        )}
      </>
    ) : null;

  // ========================================================================
  // Build each view as a ReactNode. The workspace client toggles which
  // is visible.
  // ========================================================================

  const blueprintView = (
    <ViewShell title="Blueprint" subtitle="Architecture diagram">
      {!bp ? (
        <EmptyBlueprint status={project.blueprint_status} />
      ) : isLegacyShape ? (
        <LegacyBlueprintNotice />
      ) : (
        <BlueprintDiagram
          projectName={project.name}
          projectSummary={summary}
          categories={categories}
          connections={connections}
        />
      )}
    </ViewShell>
  );

  const listView = (
    <ViewShell
      title="List"
      subtitle="Every detected component, grouped by category"
    >
      {categories.length === 0 ? (
        <EmptyBlueprint status={project.blueprint_status} />
      ) : (
        <div className="view-bp-list">
          {categories.map((cat) => (
            <BlueprintCategoryBlock key={cat.key} category={cat} />
          ))}
          {project.blueprint_generated_at && bp && (
            <div className="bp-export-row">
              <p className="bp-foot">
                Generated{" "}
                {new Date(project.blueprint_generated_at).toLocaleString(
                  undefined,
                  { dateStyle: "medium", timeStyle: "short" }
                )}
              </p>
              <ExportButtons blueprint={bp} projectName={project.name} />
            </div>
          )}
        </div>
      )}
    </ViewShell>
  );

  const decisionsView = (
    <ViewShell
      title="Decisions"
      subtitle="Architectural choices StackLense inferred from your stack"
    >
      {decisions.length === 0 ? (
        <div className="project-empty">
          <p>
            No decisions surfaced yet. They&rsquo;ll appear here once the
            blueprint has analysed enough of your project to reason about
            architectural choices.
          </p>
        </div>
      ) : (
        <ul className="bp-list">
          {decisions.map((d, i) => (
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
      )}
    </ViewShell>
  );

  const risksView = (
    <ViewShell
      title="Risks"
      subtitle="Things StackLense thinks could break or hurt you"
    >
      {risks.length === 0 ? (
        <div className="project-empty">
          <p>
            No risks surfaced. Either we haven&rsquo;t spotted any, or your
            stack is squeaky clean — both possible, neither guaranteed.
          </p>
        </div>
      ) : (
        <ul className="bp-list">
          {risks.map((f, i) => (
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
      )}
    </ViewShell>
  );

  const inventoryView = (
    <ViewShell
      title="Inventory"
      subtitle="Raw output of the last AWS discovery scan"
    >
      <BlueprintInventory
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        snapshot={project.discovery_snapshot as any}
        observedAt={project.discovery_at}
      />
    </ViewShell>
  );

  const awsView = hasEcr ? (
    <ViewShell title="AWS connection" subtitle="Health of the cross-account read role">
      {project.ecr_aws_account_id && project.ecr_webhook_token && (
        <>
          <ProjectStatusPanel
            project={project}
            deploys={deploys ?? []}
            cfnUrl={cfnUrl}
          />
          <AwsConnectionPanel
            projectId={project.id}
            awsAccountId={project.ecr_aws_account_id}
            awsRegion={project.aws_region}
            webhookToken={project.ecr_webhook_token}
            awsRoleVerifiedAt={project.aws_role_verified_at}
            awsRoleLastCheckedAt={project.aws_role_last_checked_at}
            cfnTemplateVersion={project.cfn_template_version}
            discoveryErrors={discoveryErrors}
            discoveryAt={project.discovery_at}
            blueprintStatus={project.blueprint_status}
            lastTestResult={connTestResult}
            lastTestMessage={connTestMessage}
          />
        </>
      )}
    </ViewShell>
  ) : (
    <ViewShell title="Status" subtitle="Project health">
      <ProjectStatusPanel
        project={project}
        deploys={deploys ?? []}
        cfnUrl={cfnUrl}
      />
    </ViewShell>
  );

  const updatesView = (
    <ViewShell
      title="Recent updates"
      subtitle="Deployments and synthetic events seen by StackLense"
    >
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
                <span
                  className={`deploy-source deploy-source-${d.source_type}`}
                >
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
    </ViewShell>
  );

  const settingsView = (
    <ViewShell
      title="Settings"
      subtitle="Project name, description, and the danger zone"
    >
      {errorMsg && <div className="login-error">{errorMsg}</div>}
      {savedFlash && <div className="settings-flash">✓ Changes saved.</div>}

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
                  <code className="aws-code">{project.ecr_aws_account_id}</code>
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

      <div className="settings-card settings-danger">
        <div className="settings-danger-title">Danger zone</div>
        <p className="settings-danger-desc">
          Deleting removes the project, all deploy history, and the
          generated blueprint.{" "}
          {hasGitHub &&
            "Your GitHub webhook is also removed (best-effort)."}{" "}
          {hasEcr &&
            "Your AWS CloudFormation stack stays in place; delete it manually if you no longer want events to fire."}{" "}
          This cannot be undone.
        </p>
        <DeleteProjectButton
          projectId={project.id}
          projectName={project.name}
          hasGitHub={hasGitHub}
          hasEcr={hasEcr}
        />
      </div>
    </ViewShell>
  );

  const autoRefreshSlot =
    project.blueprint_status === "generating" ||
    (!!project.ecr_aws_account_id && !project.aws_role_verified_at) ? (
      <AutoRefresh />
    ) : null;

  return (
    <ProjectWorkspaceClient
      projectName={project.name}
      status={status}
      summary={summary}
      hasAws={hasEcr}
      awsNeedsAttention={awsNeedsAttention}
      userEmail={userEmail}
      counts={{
        decisions: decisions.length,
        risks: risks.length,
        updates: deploys?.length ?? 0,
      }}
      flashes={flashes}
      autoRefreshSlot={autoRefreshSlot}
      views={{
        blueprint: blueprintView,
        list: listView,
        decisions: decisionsView,
        risks: risksView,
        inventory: inventoryView,
        aws: awsView,
        updates: updatesView,
        settings: settingsView,
      }}
    />
  );
}

// ===========================================================================
// View shell — common header for each main-pane view.
// ===========================================================================

function ViewShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="view-shell">
      <header className="view-head">
        <h2 className="view-title">{title}</h2>
        {subtitle && <p className="view-subtitle">{subtitle}</p>}
      </header>
      <div className="view-body">{children}</div>
    </div>
  );
}

function EmptyBlueprint({
  status,
}: {
  status: Project["blueprint_status"];
}) {
  return (
    <div className="project-empty">
      <p>
        {status === "generating"
          ? "Building now — your blueprint will appear here. Page refreshes automatically."
          : status === "failed"
          ? "We couldn't build the blueprint. Open the AWS connection view for the error and a regenerate button."
          : "Your blueprint will appear when your first update arrives."}
      </p>
    </div>
  );
}

function LegacyBlueprintNotice() {
  return (
    <div className="project-empty">
      <p>
        This blueprint was built with an older format. Open the AWS connection
        view and click <strong>Regenerate blueprint</strong> to rebuild it.
      </p>
    </div>
  );
}

// ===========================================================================
// Status panel (used in the AWS view) + supporting helpers
// ===========================================================================

type StageStatus = "done" | "active" | "pending" | "failed";
type Stage = {
  key: "created" | "connected" | "live";
  label: string;
  status: StageStatus;
};

function computeStages(project: Project): Stage[] {
  const isGitHub = !!project.git_repo_full_name;
  const connected = isGitHub
    ? !!project.git_webhook_id
    : !!project.aws_role_verified_at;
  const blueprintReady = project.blueprint_status === "ready";
  const blueprintFailed = project.blueprint_status === "failed";
  const raw = [
    { key: "created" as const, label: "Created", done: true, failed: false },
    { key: "connected" as const, label: "Connected", done: connected, failed: false },
    {
      key: "live" as const,
      label: "Blueprint",
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
  const stages = computeStages(project);
  const active = stages.find((s) => s.status === "active");
  const failed = stages.find((s) => s.status === "failed");
  const allDone = stages.every((s) => s.status === "done");
  const isGitHub = !!project.git_repo_full_name;
  const isEcr = !!project.ecr_webhook_token;
  const hasAnySource = isGitHub || isEcr;
  const lastDeploy = deploys[0];

  const STALE_DAYS = 7;
  const lastEventMs = lastDeploy ? new Date(lastDeploy.created_at).getTime() : null;
  const daysSinceLast =
    lastEventMs !== null
      ? Math.floor((Date.now() - lastEventMs) / 86_400_000)
      : null;
  const isStale =
    project.blueprint_status === "ready" &&
    daysSinceLast !== null &&
    daysSinceLast >= STALE_DAYS;

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
              <p className="status-action-headline">One step left:</p>
              <p className="status-action-foot">
                Open AWS setup, click <strong>Create stack</strong>{" "}
                (everything&rsquo;s pre-filled). When the stack reaches{" "}
                <code className="aws-code">CREATE_COMPLETE</code>, refresh
                this page — StackLense will detect the connection and build
                your blueprint automatically.
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
              </div>
            </>
          )}

          {!failed &&
            active?.key === "live" &&
            project.blueprint_status === "generating" && (
              <ProgressView progress={project.blueprint_progress} />
            )}

          {!failed &&
            active?.key === "live" &&
            project.blueprint_status !== "generating" && (
              <>
                <p className="status-action-headline">One step left:</p>
                {isGitHub ? (
                  <p className="status-action-foot">
                    Push code to your repo. Your first blueprint will build
                    automatically.
                  </p>
                ) : (
                  <p className="status-action-foot">
                    Ship a new version of your app — or click{" "}
                    <strong>Send a test update</strong> to fake one and watch
                    your blueprint build.
                  </p>
                )}
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
                  {hasAnySource && <TestEventButton projectId={project.id} />}
                </div>
              </>
            )}

          {allDone && isStale && (
            <>
              <p className="status-action-text status-action-stale">
                ⚠ <strong>No updates in {daysSinceLast} days.</strong> Your
                connection might have broken silently.
              </p>
              <div className="status-buttons">
                {hasAnySource && <TestEventButton projectId={project.id} />}
                <RegenerateButton projectId={project.id} />
              </div>
            </>
          )}

          {allDone && !isStale && (
            <>
              <p className="status-action-text">
                ✓ Your blueprint is live and will rebuild on every push.{" "}
                {lastDeploy
                  ? `Last update ${formatRelative(lastDeploy.created_at)}.`
                  : ""}
              </p>
              <div className="status-buttons">
                <RegenerateButton projectId={project.id} />
                {hasAnySource && <TestEventButton projectId={project.id} />}
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

const STAGE_COPY: Record<BlueprintProgress["stage"], string> = {
  starting: "Warming up the lens…",
  reading_sources: "Scanning your project sources…",
  asking_claude: "StackLense is analyzing your stack…",
  finalizing: "Saving your blueprint…",
};

function ProgressView({ progress }: { progress: BlueprintProgress | null }) {
  const stage = progress?.stage ?? "starting";
  const startedAt = progress?.started_at ?? null;
  const elapsedSec = startedAt
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      )
    : null;
  const stageLabel = STAGE_COPY[stage] ?? "Working…";
  return (
    <>
      <p className="status-action-text">
        <span className="bp-spinner" /> {stageLabel}
        {elapsedSec !== null && (
          <span className="status-elapsed"> · {formatDuration(elapsedSec)}</span>
        )}
      </p>
      <p className="status-action-foot">
        Most blueprints take 30–90 seconds. Page updates automatically.
      </p>
    </>
  );
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
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

function BlueprintCategoryBlock({
  category,
}: {
  category: BlueprintCategory;
}) {
  const empty = !category.components || category.components.length === 0;
  return (
    <div className={`bp-cat ${empty ? "bp-cat-empty" : ""}`}>
      <h3 className="bp-cat-label">{category.label}</h3>
      {empty ? (
        <p className="bp-cat-empty-text">Not detected</p>
      ) : (
        <ul className="bp-cat-list">
          {category.components.map((c) => (
            <li key={c.id} className="bp-cat-item">
              <div className="bp-cat-item-head">
                <VendorLogo vendor={c.vendor ?? c.name} size={28} />
                <div className="bp-cat-item-text">
                  {c.console_url ? (
                    <a
                      href={c.console_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bp-cat-item-name"
                    >
                      {c.name} ↗
                    </a>
                  ) : (
                    <span className="bp-cat-item-name">{c.name}</span>
                  )}
                  {c.vendor && c.vendor !== c.name && (
                    <span className="bp-cat-item-vendor">{c.vendor}</span>
                  )}
                </div>
              </div>
              <p className="bp-cat-item-desc">{c.description}</p>
              {c.evidence && (
                <p className="bp-evidence">Detected: {c.evidence}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
