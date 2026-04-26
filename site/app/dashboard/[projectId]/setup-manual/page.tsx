import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const CFN_TEMPLATE_URL =
  process.env.NEXT_PUBLIC_CFN_TEMPLATE_URL ||
  "https://stacklense-cfn-templates.s3.amazonaws.com/connect-stacklense.yaml";

type Project = {
  id: string;
  name: string;
  git_repo_full_name: string | null;
  git_webhook_secret: string | null;
  ecr_webhook_token: string | null;
};

/**
 * Manual setup instructions — fallback when Quick Create fails or for
 * advanced users who want full control. Branches by which source(s) the
 * project has connected.
 */
export default async function SetupManualPage({
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
      "id, name, git_repo_full_name, git_webhook_secret, ecr_webhook_token"
    )
    .eq("id", projectId)
    .single<Project>();

  if (error || !project) notFound();

  const hasEcr = !!project.ecr_webhook_token;
  const hasGitHub = !!project.git_repo_full_name;

  return (
    <>
      <div className="dash-greeting">
        <Link href={`/dashboard/${project.id}`} className="connect-back">
          ← Back to project
        </Link>
        <div className="dash-section-label">Manual setup</div>
        <h1 className="dash-h1">{project.name}</h1>
        <p className="dash-sub">
          Use these steps if Quick Create didn&rsquo;t work, or if you prefer
          full control over what gets installed in your account.
        </p>
      </div>

      {hasEcr && (
        <ManualAwsEcr
          token={project.ecr_webhook_token!}
          templateUrl={CFN_TEMPLATE_URL}
        />
      )}

      {hasGitHub && (
        <ManualGitHub
          repoFullName={project.git_repo_full_name!}
          secret={project.git_webhook_secret ?? ""}
        />
      )}

      {!hasEcr && !hasGitHub && (
        <div className="project-empty">
          <p>
            This project has no connected sources yet. Go back and connect
            via GitHub or AWS ECR first.
          </p>
        </div>
      )}
    </>
  );
}

function ManualAwsEcr({
  token,
  templateUrl,
}: {
  token: string;
  templateUrl: string;
}) {
  const webhookUrl = `https://stacklense.com/api/webhooks/aws/${token}`;

  return (
    <section className="project-section">
      <h2 className="dash-h2">AWS ECR — manual install</h2>

      <ol className="aws-steps">
        <li className="aws-step">
          <div className="aws-step-num">1</div>
          <div className="aws-step-body">
            <div className="aws-step-title">
              Download the CloudFormation template
            </div>
            <p className="aws-step-desc">
              Right-click the link below and save the YAML, or open it and
              copy the contents.
            </p>
            <a
              href={templateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="aws-action-btn"
            >
              Download connect-stacklense.yaml →
            </a>
          </div>
        </li>

        <li className="aws-step">
          <div className="aws-step-num">2</div>
          <div className="aws-step-body">
            <div className="aws-step-title">
              Create the stack in CloudFormation
            </div>
            <p className="aws-step-desc">
              Open AWS CloudFormation in <strong>us-east-1</strong>, click{" "}
              <strong>Create stack</strong> → <strong>With new resources</strong>.
              Choose <strong>Upload a template file</strong> and pick the
              YAML you downloaded. Click Next.
            </p>
            <a
              href="https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create"
              target="_blank"
              rel="noopener noreferrer"
              className="bp-banner-link"
            >
              Open CloudFormation create page →
            </a>
          </div>
        </li>

        <li className="aws-step">
          <div className="aws-step-num">3</div>
          <div className="aws-step-body">
            <div className="aws-step-title">Set parameters</div>
            <p className="aws-step-desc">
              <strong>Stack name:</strong> any value, suggested{" "}
              <code className="aws-code">StackLenseConnect</code>.
              <br />
              <br />
              <strong>WebhookToken parameter:</strong> paste this exact value:
            </p>
            <code className="aws-code aws-code-block">{token}</code>
            <p className="aws-step-hint">
              The token uniquely identifies your project to our webhook.
              Don&rsquo;t edit it, share it, or commit it to a public repo.
            </p>
          </div>
        </li>

        <li className="aws-step">
          <div className="aws-step-num">4</div>
          <div className="aws-step-body">
            <div className="aws-step-title">Acknowledge IAM and create</div>
            <p className="aws-step-desc">
              On the review page, check the box that says{" "}
              <strong>
                &ldquo;I acknowledge that AWS CloudFormation might create IAM
                resources&rdquo;
              </strong>
              . Click <strong>Submit</strong>. Wait ~60 seconds for status{" "}
              <code className="aws-code">CREATE_COMPLETE</code>.
            </p>
          </div>
        </li>

        <li className="aws-step">
          <div className="aws-step-num">5</div>
          <div className="aws-step-body">
            <div className="aws-step-title">Trigger first event</div>
            <p className="aws-step-desc">
              Push any image to ECR. The EventBridge rule fires, our webhook
              receives the event, blueprint generates. Watch the project page
              for the status to flip from &ldquo;Pending&rdquo; to
              &ldquo;Generating&rdquo; to &ldquo;Ready&rdquo;.
            </p>
          </div>
        </li>
      </ol>

      <details className="manual-advanced">
        <summary>
          Advanced: build the EventBridge rule yourself (without
          CloudFormation)
        </summary>
        <p className="manual-advanced-body">
          If you don&rsquo;t want to use CloudFormation at all, you can
          create the equivalent resources by hand. You need an EventBridge
          rule on <code className="aws-code">aws.ecr</code> push events that
          forwards to an API destination pointing at this URL:
        </p>
        <code className="aws-code aws-code-block">{webhookUrl}</code>
        <p className="manual-advanced-body">
          The API destination&rsquo;s connection should add an HTTP header{" "}
          <code className="aws-code">X-StackLense-Token</code> with the same
          token value as the URL path (defense in depth — both are
          validated).
        </p>
      </details>
    </section>
  );
}

function ManualGitHub({
  repoFullName,
  secret,
}: {
  repoFullName: string;
  secret: string;
}) {
  const webhookUrl = "https://stacklense.com/api/webhooks/github";
  const settingsUrl = `https://github.com/${repoFullName}/settings/hooks/new`;

  return (
    <section className="project-section">
      <h2 className="dash-h2">GitHub — manual install</h2>
      <p className="dash-sub" style={{ marginBottom: 24 }}>
        Use this if our automatic webhook installation failed (e.g.{" "}
        <code className="aws-code">repo</code> scope was missing or the
        OAuth token expired).
      </p>

      <ol className="aws-steps">
        <li className="aws-step">
          <div className="aws-step-num">1</div>
          <div className="aws-step-body">
            <div className="aws-step-title">Open the repo&rsquo;s webhook settings</div>
            <a
              href={settingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="aws-action-btn"
            >
              Open {repoFullName} → Settings → Webhooks → Add →
            </a>
          </div>
        </li>

        <li className="aws-step">
          <div className="aws-step-num">2</div>
          <div className="aws-step-body">
            <div className="aws-step-title">Fill the webhook form</div>
            <p className="aws-step-desc">
              <strong>Payload URL:</strong>
            </p>
            <code className="aws-code aws-code-block">{webhookUrl}</code>
            <p className="aws-step-desc" style={{ marginTop: 12 }}>
              <strong>Content type:</strong>{" "}
              <code className="aws-code">application/json</code>
              <br />
              <strong>Secret:</strong> paste this exact value:
            </p>
            <code className="aws-code aws-code-block">{secret}</code>
            <p className="aws-step-desc" style={{ marginTop: 12 }}>
              <strong>SSL verification:</strong> Enabled.
              <br />
              <strong>Events:</strong> &ldquo;Just the push event&rdquo;.
              <br />
              <strong>Active:</strong> Checked.
            </p>
            <p className="aws-step-hint">
              Click <strong>Add webhook</strong>. GitHub will send a ping —
              if you see a green checkmark, the webhook is wired up.
            </p>
          </div>
        </li>

        <li className="aws-step">
          <div className="aws-step-num">3</div>
          <div className="aws-step-body">
            <div className="aws-step-title">Trigger first event</div>
            <p className="aws-step-desc">
              Push a commit to the repo. The webhook fires, blueprint
              regenerates.
            </p>
          </div>
        </li>
      </ol>
    </section>
  );
}
