/**
 * AWS connection panel — surfaces, in one place, everything the customer
 * needs to manage the link between their AWS account and StackLense:
 *
 *   - A status pill (Healthy / Stack outdated / Permission gap /
 *     Connection broken / Not yet connected) so they can see at a glance
 *     whether the connection is working.
 *   - A "Test connection" button that runs sts:AssumeRole on demand. Used
 *     right after they update the CFN stack, or when something silently
 *     stops working.
 *   - An "Update AWS connection" deep link that opens AWS Console
 *     filtered to the customer's StackLenseConnect stack, plus a copy
 *     button for the new template URL they need to paste into the AWS
 *     Update wizard. (AWS has no URL pattern that pre-fills a stack
 *     update, so the paste step is unavoidable.)
 *   - A "Manage stack in AWS" link for general maintenance — viewing the
 *     stack, deleting it, drilling into the IAM role.
 *   - A "View IAM role" link for permission-level debugging.
 *   - A breakdown of any AccessDenied errors from the last discovery run,
 *     so customers can see exactly which services we couldn't read and
 *     fix the right thing instead of guessing.
 *
 * This is the first place a customer should land if anything looks wrong
 * with their AWS data — it's diagnostics + remediation in one card.
 */

import { CopyButton } from "./CopyButton";
import { TestConnectionButton } from "./TestConnectionButton";
import {
  CFN_TEMPLATE_URL,
  CFN_TEMPLATE_VERSION,
  CFN_TEMPLATE_CHANGELOG,
  STACKLENSE_STACK_NAME,
  buildManageStackUrl,
  buildIamRoleUrl,
  compareTemplateVersion,
  summarizeDiscoveryErrors,
  type DiscoveryErrorSummary,
  type ParsedDiscoveryError,
} from "@/lib/cfn";

type Props = {
  projectId: string;
  awsAccountId: string;
  awsRegion: string | null;
  webhookToken: string;
  awsRoleVerifiedAt: string | null;
  awsRoleLastCheckedAt: string | null;
  cfnTemplateVersion: string | null;
  discoveryErrors:
    | Array<{ source: string; message: string }>
    | null
    | undefined;
  discoveryAt: string | null;
  // Whether a discovery run is in flight right now. When true, the
  // panel shows an inline spinner so the user has feedback right where
  // they clicked, not just up in the Status panel.
  blueprintStatus: "pending" | "generating" | "ready" | "failed";
  // Flash state from the last test-connection action.
  lastTestResult: "ok" | "fail" | null;
  lastTestMessage: string | null;
};

type ConnectionState =
  | "healthy"
  | "stack-outdated"
  | "permission-gap"
  | "broken"
  | "not-verified";

export function AwsConnectionPanel(props: Props) {
  const versionState = compareTemplateVersion(props.cfnTemplateVersion);
  const errSummary = summarizeDiscoveryErrors(props.discoveryErrors);

  const state = computeState({
    verified: !!props.awsRoleVerifiedAt,
    lastCheckedAt: props.awsRoleLastCheckedAt,
    versionState,
    hasPermissionGap: errSummary.hasPermissionGap,
  });

  const manageUrl = buildManageStackUrl({
    region: props.awsRegion ?? undefined,
  });
  const iamUrl = buildIamRoleUrl({ accountId: props.awsAccountId });

  return (
    <section className="project-section">
      <h2 className="dash-h2">AWS connection</h2>

      <div className="aws-conn-card">
        <div className="aws-conn-header">
          <ConnectionPill state={state} />
          <ConnectionMeta
            verifiedAt={props.awsRoleVerifiedAt}
            lastCheckedAt={props.awsRoleLastCheckedAt}
            region={props.awsRegion}
            accountId={props.awsAccountId}
          />
        </div>

        {/*
          When the blueprint is generating, a discovery run is in flight
          (auto, or just kicked off by Test connection). Show this inline
          so the customer has feedback right where they clicked.
         */}
        {props.blueprintStatus === "generating" && (
          <div className="aws-conn-flash aws-conn-flash-running">
            <span className="aws-test-conn-spinner" aria-hidden="true" />
            Re-running discovery — checking which AWS services we can read
            with the current permissions. This usually takes 30–60 seconds.
            The page refreshes automatically.
          </div>
        )}
        {/*
          Only show the "Connection healthy" flash if the connection is
          actually healthy. AssumeRole succeeding is necessary but not
          sufficient — if discovery still has permission gaps, the flash
          contradicts the panel's primary state and confuses the customer.
         */}
        {props.blueprintStatus !== "generating" &&
          props.lastTestResult === "ok" &&
          state === "healthy" && (
            <div className="aws-conn-flash aws-conn-flash-ok">
              ✓ Connection healthy. We assumed the read-only role and
              re-ran discovery successfully.
            </div>
          )}
        {props.blueprintStatus !== "generating" &&
          props.lastTestResult === "ok" &&
          state !== "healthy" && (
            <div className="aws-conn-flash aws-conn-flash-warn">
              We assumed the read-only role, but discovery still hit
              issues. See <em>Action required</em> below.
            </div>
          )}
        {props.lastTestResult === "fail" && (
          <div className="aws-conn-flash aws-conn-flash-err">
            ✗ Connection check failed.{" "}
            {props.lastTestMessage ? (
              <code className="aws-code">{props.lastTestMessage}</code>
            ) : (
              "Check the stack exists and the trust policy is intact."
            )}
          </div>
        )}

        <ActionRequiredOrSummary
          state={state}
          errSummary={errSummary}
          manageUrl={manageUrl}
          iamUrl={iamUrl}
          projectId={props.projectId}
        />

        {(state === "stack-outdated" || state === "permission-gap") && (
          <UpdateInstructions
            templateUrl={CFN_TEMPLATE_URL}
            stackName={STACKLENSE_STACK_NAME}
          />
        )}

        {errSummary.total > 0 && (
          <DiscoveryErrorList
            summary={errSummary}
            // Open by default when there's a permission gap so the
            // customer sees exactly which AWS API call failed without
            // having to click. They almost certainly want this info.
            defaultOpen={errSummary.hasPermissionGap}
          />
        )}

        <details className="aws-conn-details">
          <summary>Connection details</summary>
          <dl className="aws-conn-dl">
            <dt>AWS account</dt>
            <dd>
              <code className="aws-code">{props.awsAccountId}</code>
            </dd>
            <dt>Region</dt>
            <dd>
              <code className="aws-code">
                {props.awsRegion ?? "us-east-1 (default)"}
              </code>
            </dd>
            <dt>Stack name</dt>
            <dd>
              <code className="aws-code">{STACKLENSE_STACK_NAME}</code>
            </dd>
            <dt>Template version installed</dt>
            <dd>
              <code className="aws-code">
                {props.cfnTemplateVersion ?? "(not yet recorded)"}
              </code>
            </dd>
            <dt>Current StackLense template</dt>
            <dd>
              <code className="aws-code">{CFN_TEMPLATE_VERSION}</code>
            </dd>
            <dt>Last discovery</dt>
            <dd>
              {props.discoveryAt
                ? new Date(props.discoveryAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Never"}
            </dd>
          </dl>
        </details>
      </div>
    </section>
  );
}

function computeState(args: {
  verified: boolean;
  lastCheckedAt: string | null;
  versionState: "current" | "outdated" | "unknown";
  hasPermissionGap: boolean;
}): ConnectionState {
  if (!args.verified) {
    // Either never verified or last verification failed.
    if (args.lastCheckedAt) return "broken";
    return "not-verified";
  }
  if (args.hasPermissionGap) return "permission-gap";
  if (args.versionState === "outdated") return "stack-outdated";
  return "healthy";
}

function ConnectionPill({ state }: { state: ConnectionState }) {
  const meta: Record<
    ConnectionState,
    { label: string; tone: string; dot: string }
  > = {
    healthy: { label: "Connection healthy", tone: "ok", dot: "✓" },
    "stack-outdated": {
      label: "Update available",
      tone: "warn",
      dot: "⟳",
    },
    "permission-gap": {
      label: "Permission gap",
      tone: "warn",
      dot: "!",
    },
    broken: { label: "Connection broken", tone: "err", dot: "✗" },
    "not-verified": {
      label: "Not yet verified",
      tone: "neutral",
      dot: "·",
    },
  };
  const m = meta[state];
  return (
    <span className={`aws-conn-pill aws-conn-pill-${m.tone}`}>
      <span className="aws-conn-pill-dot">{m.dot}</span>
      {m.label}
    </span>
  );
}

function ConnectionMeta({
  verifiedAt,
  lastCheckedAt,
  region,
  accountId,
}: {
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  region: string | null;
  accountId: string;
}) {
  const display = verifiedAt ?? lastCheckedAt;
  return (
    <div className="aws-conn-meta">
      <code className="aws-code">{accountId}</code>
      {region && (
        <>
          {" · "}
          <code className="aws-code">{region}</code>
        </>
      )}
      {display && (
        <>
          {" · "}
          <span className="aws-conn-meta-time">
            {verifiedAt ? "verified" : "last checked"}{" "}
            {formatRelative(display)}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Top-of-panel action card. The single source of truth for "what should
 * the customer do next?". Each state owns:
 *   - A plain-English headline saying what's wrong (or that nothing is)
 *   - One sentence of context
 *   - A primary CTA — the ONE button that solves it
 *   - Compact secondary actions for power-user paths
 *
 * No raw AWS strings, no overlapping flashes, no decision-making left to
 * the customer. They scan the headline, click the primary button.
 */
function ActionRequiredOrSummary({
  state,
  errSummary,
  manageUrl,
  iamUrl,
  projectId,
}: {
  state: ConnectionState;
  errSummary: DiscoveryErrorSummary;
  manageUrl: string;
  iamUrl: string;
  projectId: string;
}) {
  if (state === "healthy") {
    return (
      <div className="aws-conn-action aws-conn-action-ok">
        <div className="aws-conn-action-body">
          <h3 className="aws-conn-action-title">Everything looks good</h3>
          <p className="aws-conn-action-copy">
            StackLense can read your AWS account and discovery completed
            without errors. Blueprints will refresh automatically on every
            push.
          </p>
        </div>
        <div className="aws-conn-action-buttons">
          <TestConnectionButton projectId={projectId} />
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="status-secondary-btn"
          >
            Manage stack in AWS →
          </a>
          <a
            href={iamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="status-secondary-btn"
          >
            View IAM role →
          </a>
        </div>
      </div>
    );
  }

  if (state === "permission-gap" || state === "stack-outdated") {
    // Plain-English service list — what's broken, not what AWS error
    // codes say. Customer reads "ACM, SNS, ..." not "acm:ListCertificates".
    const failingServices = Array.from(
      new Set(errSummary.accessDenied.map((e) => prettyServiceName(e.source)))
    );
    const hasGap = state === "permission-gap";
    const newest = CFN_TEMPLATE_CHANGELOG[0];
    return (
      <div className="aws-conn-action aws-conn-action-warn">
        <div className="aws-conn-action-body">
          <h3 className="aws-conn-action-title">
            Action required — update your AWS stack
          </h3>
          {hasGap ? (
            <>
              <p className="aws-conn-action-copy">
                We can connect to your AWS account but can&rsquo;t read{" "}
                <strong>
                  {failingServices.length} service
                  {failingServices.length === 1 ? "" : "s"}
                </strong>{" "}
                yet:
              </p>
              <ul className="aws-conn-chip-list">
                {failingServices.map((s) => (
                  <li key={s} className="aws-conn-chip aws-conn-chip-warn">
                    {s}
                  </li>
                ))}
              </ul>
              <p className="aws-conn-action-copy">
                These services are read by permissions that were added to
                StackLense&rsquo;s connection template recently. One stack
                update grants them all.
              </p>
            </>
          ) : (
            <p className="aws-conn-action-copy">
              StackLense shipped a newer connection template. Updating
              takes ~60 seconds and is one paste in AWS Console.
              {newest && (
                <>
                  {" "}
                  <span className="aws-conn-action-meta">
                    What&rsquo;s new: {newest.summary}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <div className="aws-conn-action-buttons">
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="aws-action-btn aws-action-btn-primary"
          >
            Update AWS connection →
          </a>
          <TestConnectionButton projectId={projectId} />
          <a
            href={iamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="status-secondary-btn"
          >
            View IAM role →
          </a>
        </div>
      </div>
    );
  }

  if (state === "broken") {
    return (
      <div className="aws-conn-action aws-conn-action-err">
        <div className="aws-conn-action-body">
          <h3 className="aws-conn-action-title">
            We can&rsquo;t connect to your AWS account
          </h3>
          <p className="aws-conn-action-copy">
            StackLense couldn&rsquo;t assume the read-only role. The most
            common reasons:
          </p>
          <ul className="aws-conn-cause-list">
            <li>The CloudFormation stack was deleted or renamed.</li>
            <li>
              Someone edited the role&rsquo;s trust policy and removed
              StackLense from it.
            </li>
            <li>The WebhookToken parameter was changed.</li>
          </ul>
        </div>
        <div className="aws-conn-action-buttons">
          <TestConnectionButton projectId={projectId} />
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="status-secondary-btn"
          >
            Manage stack in AWS →
          </a>
          <a
            href={iamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="status-secondary-btn"
          >
            View IAM role →
          </a>
        </div>
      </div>
    );
  }

  // not-verified
  return (
    <div className="aws-conn-action aws-conn-action-pending">
      <div className="aws-conn-action-body">
        <h3 className="aws-conn-action-title">
          Waiting for your CloudFormation stack
        </h3>
        <p className="aws-conn-action-copy">
          Finish the install in AWS — once the stack reaches{" "}
          <code className="aws-code">CREATE_COMPLETE</code>, refresh this
          page and we&rsquo;ll auto-verify. You can also click{" "}
          <strong>Test connection</strong> to check on demand.
        </p>
      </div>
      <div className="aws-conn-action-buttons">
        <TestConnectionButton projectId={projectId} />
        <a
          href={manageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="status-secondary-btn"
        >
          Manage stack in AWS →
        </a>
      </div>
    </div>
  );
}

function UpdateInstructions({
  templateUrl,
}: {
  templateUrl: string;
  stackName: string;
}) {
  return (
    <div className="aws-conn-update">
      <h3 className="aws-conn-update-title">
        Update your stack — ~60 seconds, one paste
      </h3>

      <p className="aws-conn-update-lede">
        Copy this URL. You&rsquo;ll paste it once in AWS:
      </p>

      <div className="aws-conn-copy-row aws-conn-copy-row-hero">
        <code className="aws-code aws-code-block">{templateUrl}</code>
        <CopyButton value={templateUrl} label="Copy URL" />
      </div>

      <p className="aws-conn-update-lede">Then in AWS:</p>

      <ol className="aws-conn-update-compact">
        <li>
          Click <strong>Update AWS connection</strong> above, then click
          your stack name.
        </li>
        <li>
          <strong>Update</strong> → <strong>Make a direct update</strong>{" "}
          → <strong>Next</strong>.
        </li>
        <li>
          <strong>Replace existing template</strong> → paste the URL above
          → <strong>Next</strong>.
        </li>
        <li>
          <strong>Next</strong>, <strong>Next</strong> (don&rsquo;t change{" "}
          <code className="aws-code">WebhookToken</code>).
        </li>
        <li>
          Check the IAM box → <strong>Submit</strong>.
        </li>
      </ol>

      <p className="aws-conn-update-tip">
        When the stack shows{" "}
        <code className="aws-code">UPDATE_COMPLETE</code>, come back here
        and click <strong>Test connection</strong>.
      </p>

      <details className="aws-conn-update-detail">
        <summary>Need every screen explained? Show full walkthrough</summary>
        <ol className="aws-conn-update-steps">
          <li>
            Click <strong>Update AWS connection</strong> above. AWS opens
            your stack list. Click the <strong>StackLenseConnect</strong>{" "}
            stack name to open it.
          </li>
          <li>
            Top right, click the <strong>Update</strong> button.
          </li>
          <li>
            <strong>Update method</strong> screen → choose{" "}
            <strong>Make a direct update</strong>. <strong>Next</strong>.
          </li>
          <li>
            <strong>Prepare template</strong> screen → choose{" "}
            <strong>Replace existing template</strong>.
          </li>
          <li>
            <strong>Specify template</strong> → <strong>Amazon S3 URL</strong>{" "}
            → paste the URL from above → <strong>Next</strong>.
          </li>
          <li>
            <strong>Specify stack details</strong> → leave the{" "}
            <code className="aws-code">WebhookToken</code> value alone (if
            you change it, events from your AWS account stop matching this
            project). <strong>Next</strong>.
          </li>
          <li>
            <strong>Configure stack options</strong> → all defaults are
            fine. <strong>Next</strong>.
          </li>
          <li>
            Review page → scroll down → check{" "}
            <strong>
              &ldquo;I acknowledge that AWS CloudFormation might create
              IAM resources&rdquo;
            </strong>{" "}
            → <strong>Submit</strong>.
          </li>
          <li>
            Wait ~30 seconds for{" "}
            <code className="aws-code">UPDATE_COMPLETE</code>.
          </li>
          <li>
            Back here → <strong>Test connection</strong>. The status pill
            flips to <strong>Connection healthy</strong> once discovery
            confirms the new permissions.
          </li>
        </ol>
      </details>
    </div>
  );
}

function DiscoveryErrorList({
  summary,
  defaultOpen,
}: {
  summary: DiscoveryErrorSummary;
  defaultOpen?: boolean;
}) {
  return (
    <details className="aws-conn-errors" open={defaultOpen}>
      <summary>
        Diagnostics — what AWS told us
      </summary>

      {summary.hasPermissionGap && (
        <AlreadyUpdatedFAQ />
      )}

      {summary.accessDenied.length > 0 && (
        <div className="aws-conn-errors-block">
          <p className="aws-conn-errors-label">
            Permission gaps ({summary.accessDenied.length})
          </p>
          <div className="aws-conn-error-cards">
            {summary.accessDenied.map((e, i) => (
              <ErrorCard key={`ad-${i}`} error={e} />
            ))}
          </div>
        </div>
      )}

      {summary.other.length > 0 && (
        <div className="aws-conn-errors-block">
          <p className="aws-conn-errors-label">
            Other errors ({summary.other.length})
          </p>
          <div className="aws-conn-error-cards">
            {summary.other.map((e, i) => (
              <ErrorCard key={`o-${i}`} error={e} />
            ))}
          </div>
        </div>
      )}
    </details>
  );
}

/**
 * Single error rendered as a structured card. Three rows of info that
 * line up across the list — service name on top (always present), the
 * IAM action when we could parse one (the actionable bit), and a "Show
 * raw AWS error" disclosure for debugging. Customer can scan the
 * service name + action and skip the raw text entirely.
 */
function ErrorCard({ error }: { error: ParsedDiscoveryError }) {
  return (
    <div
      className={`aws-conn-error-card ${
        error.isPermissionGap ? "aws-conn-error-card-warn" : ""
      }`}
    >
      <div className="aws-conn-error-card-head">
        <span className="aws-conn-error-card-service">
          {prettyServiceName(error.source)}
        </span>
        {error.iamAction && (
          <span className="aws-conn-error-card-action">
            IAM action:{" "}
            <code className="aws-code">{error.iamAction.full}</code>
          </span>
        )}
        <span
          className={`aws-conn-error-card-tag ${
            error.isPermissionGap
              ? "aws-conn-error-card-tag-warn"
              : "aws-conn-error-card-tag-info"
          }`}
        >
          {error.isPermissionGap ? "missing permission" : "other error"}
        </span>
      </div>
      <details className="aws-conn-error-card-raw">
        <summary>Show raw AWS message</summary>
        <pre className="aws-conn-error-card-pre">{error.message}</pre>
      </details>
    </div>
  );
}

/**
 * Mini-FAQ surfaced inside the diagnostics drawer. Addresses the
 * specific "I just updated my stack and the panel still says permission
 * gap, what gives?" scenario — the most common reason permission errors
 * persist after a customer believes they updated.
 */
function AlreadyUpdatedFAQ() {
  return (
    <div className="aws-conn-faq">
      <p className="aws-conn-faq-title">
        I already updated my stack — why is it still failing?
      </p>
      <p className="aws-conn-faq-line">
        99% of the time, one of these:
      </p>
      <ol className="aws-conn-faq-list">
        <li>
          On the <strong>Prepare template</strong> screen you picked{" "}
          <em>Use existing template</em> instead of{" "}
          <em>Replace existing template</em> — so the new IAM policy
          never got applied. Run the update again with the right
          option.
        </li>
        <li>
          The update is still in progress. CloudFormation says{" "}
          <code className="aws-code">UPDATE_IN_PROGRESS</code> for ~30
          seconds; only when it shows{" "}
          <code className="aws-code">UPDATE_COMPLETE</code> are the new
          permissions live.
        </li>
        <li>
          You created a change set but didn&rsquo;t execute it. Open the
          stack and look for an unexecuted change set under the{" "}
          <em>Change sets</em> tab.
        </li>
      </ol>
      <p className="aws-conn-faq-line">
        Then click <strong>Test connection</strong> to re-check.
      </p>
    </div>
  );
}

/**
 * Map the discovery `source` strings (which are the internal
 * Promise.all keys: "ses-identities", "waf", "event-buses", etc.)
 * to friendly service names a customer recognises.
 */
function prettyServiceName(source: string): string {
  const map: Record<string, string> = {
    ecr: "ECR",
    ecs: "ECS",
    s3: "S3",
    logs: "CloudWatch Logs",
    elb: "Load balancers (ELB)",
    route53: "Route 53",
    secrets: "Secrets Manager",
    lambda: "Lambda",
    cloudfront: "CloudFront",
    "rds-instances": "RDS instances",
    "rds-clusters": "RDS clusters",
    dynamodb: "DynamoDB",
    "ses-identities": "SES identities",
    "ses-config-sets": "SES configuration sets",
    waf: "WAF",
    acm: "ACM certificates",
    "event-buses": "EventBridge buses",
    sns: "SNS",
    sqs: "SQS",
    cognito: "Cognito",
  };
  return map[source] ?? source;
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

