import Link from "next/link";
import { randomBytes } from "crypto";
import { connectAwsProject } from "./actions";

export const dynamic = "force-dynamic";

const STACKLENSE_AWS_ACCOUNT = "573631992878";
const TEMPLATE_URL = "https://stacklense.com/aws/connect-stacklense.yaml";

function generateExternalId() {
  return randomBytes(16).toString("hex");
}

function buildQuickCreateUrl(externalId: string) {
  const params = new URLSearchParams({
    templateURL: TEMPLATE_URL,
    stackName: "StackLenseConnect",
    param_ExternalId: externalId,
    param_StackLenseAccountId: STACKLENSE_AWS_ACCOUNT,
  });
  return `https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/quickcreate?${params.toString()}`;
}

export default async function ConnectAwsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMsg = params.error ? decodeURIComponent(params.error) : null;

  // Generate a fresh external ID for this attempt — gets baked into the
  // CloudFormation Quick Create URL and submitted back with the form.
  const externalId = generateExternalId();
  const quickCreateUrl = buildQuickCreateUrl(externalId);

  return (
    <>
      <div className="dash-greeting">
        <Link href="/dashboard/connect" className="connect-back">
          ← Pick a different connect method
        </Link>
        <div className="dash-section-label">Connect — AWS</div>
        <h1 className="dash-h1">Connect your AWS account</h1>
        <p className="dash-sub">
          Three steps. Read-only role, no mutating permissions.
        </p>
      </div>

      {errorMsg && <div className="login-error">{errorMsg}</div>}

      <ol className="aws-steps">
        <li className="aws-step">
          <div className="aws-step-num">1</div>
          <div className="aws-step-body">
            <div className="aws-step-title">Open the CloudFormation stack</div>
            <p className="aws-step-desc">
              Click the button below. AWS will open with the stack pre-filled.
              Sign in to the AWS account where your project lives.
            </p>
            <a
              href={quickCreateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="aws-action-btn"
            >
              Open CloudFormation in AWS →
            </a>
            <p className="aws-step-hint">
              External ID for this stack:{" "}
              <code className="aws-code">{externalId}</code>
            </p>
          </div>
        </li>

        <li className="aws-step">
          <div className="aws-step-num">2</div>
          <div className="aws-step-body">
            <div className="aws-step-title">Create the stack</div>
            <p className="aws-step-desc">
              Check the box that says &ldquo;I acknowledge that AWS
              CloudFormation might create IAM resources&rdquo;, then click{" "}
              <strong>Create stack</strong>. Wait ~30 seconds for status to go{" "}
              <code className="aws-code">CREATE_COMPLETE</code>.
            </p>
          </div>
        </li>

        <li className="aws-step">
          <div className="aws-step-num">3</div>
          <div className="aws-step-body">
            <div className="aws-step-title">Paste the role ARN</div>
            <p className="aws-step-desc">
              On the stack page in AWS, click the{" "}
              <strong>Outputs</strong> tab. Copy the{" "}
              <code className="aws-code">RoleArn</code> value and paste it
              below along with your AWS account ID and a name for this
              project.
            </p>

            <form action={connectAwsProject} className="aws-form">
              <input
                type="hidden"
                name="external_id"
                value={externalId}
              />

              <label className="form-label" htmlFor="project_name">
                Project name
              </label>
              <input
                id="project_name"
                name="project_name"
                type="text"
                required
                placeholder="msp-lighthouse"
                className="login-input"
              />

              <label className="form-label" htmlFor="description">
                Description (optional)
              </label>
              <input
                id="description"
                name="description"
                type="text"
                placeholder="MSP platform — Node.js on ECS Fargate"
                className="login-input"
              />

              <label className="form-label" htmlFor="aws_account_id">
                AWS account ID
              </label>
              <input
                id="aws_account_id"
                name="aws_account_id"
                type="text"
                required
                pattern="[0-9]{12}"
                placeholder="123456789012"
                className="login-input"
              />

              <label className="form-label" htmlFor="role_arn">
                Role ARN (from CloudFormation Outputs)
              </label>
              <input
                id="role_arn"
                name="role_arn"
                type="text"
                required
                pattern="arn:aws:iam::[0-9]{12}:role/.+"
                placeholder="arn:aws:iam::123456789012:role/StackLense-ReadOnly-..."
                className="login-input"
              />

              <button type="submit" className="login-btn aws-submit">
                Finish connecting →
              </button>
            </form>
          </div>
        </li>
      </ol>
    </>
  );
}
