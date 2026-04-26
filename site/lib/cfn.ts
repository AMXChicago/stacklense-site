/**
 * Single source of truth for the StackLense CloudFormation template the
 * customer installs in their AWS account.
 *
 * Two responsibilities:
 *
 *   1. Versioning. Every meaningful change to connect-stacklense.yaml (new
 *      IAM permissions, schema bumps, etc.) means existing customer stacks
 *      become outdated. We bump CFN_TEMPLATE_VERSION below; the dashboard
 *      compares against each project's stored cfn_template_version and
 *      surfaces an "update available" banner.
 *
 *   2. AWS console deep links. The customer needs to open AWS Console at
 *      the right place to install, update, or troubleshoot the stack.
 *      Centralising the URL building keeps the format consistent and lets
 *      us swap regions per-project as soon as we support multi-region.
 *
 * We deliberately do NOT have permission to update the customer's stack
 * programmatically. The trust we ask for is read-only, by design — that's
 * the whole pitch. So updates are always a one-click deep link into the
 * customer's AWS Console, not an API call.
 */

/**
 * Bump this whenever site/public/aws/connect-stacklense.yaml changes in a
 * way that requires customers to redeploy the stack (new IAM permissions,
 * new EventBridge rules, parameter changes, etc.). Format is loosely
 * date-based with a short slug so it's readable in the DB and in logs.
 *
 * History:
 *   2026-04-26-v1-base                — initial template, ECR + ECS + S3 + …
 *   2026-04-26-v2-discovery-expansion — added SES, WAF, ACM, EventBridge
 *                                       buses, SNS, SQS, Cognito read perms
 */
export const CFN_TEMPLATE_VERSION = "2026-04-26-v2-discovery-expansion";

/**
 * Short, customer-facing changelog rendered in the "Update available"
 * banner so they understand WHY they're being asked to click again.
 * Add a new entry whenever you bump CFN_TEMPLATE_VERSION above.
 */
export const CFN_TEMPLATE_CHANGELOG: Array<{
  version: string;
  date: string;
  summary: string;
}> = [
  {
    version: "2026-04-26-v2-discovery-expansion",
    date: "Apr 26, 2026",
    summary:
      "Adds read access for SES (transactional email), WAF, ACM certificates, EventBridge buses, SNS, SQS, and Cognito so blueprints reflect those services.",
  },
  {
    version: "2026-04-26-v1-base",
    date: "Apr 26, 2026",
    summary:
      "Initial connection — installs the read-only role and the EventBridge → StackLense webhook rule.",
  },
];

/**
 * Default stack name we recommend in Quick Create. Customers can rename it,
 * but if they accept the default we get a stable handle for deep-linking
 * back to the stack page.
 */
export const STACKLENSE_STACK_NAME = "StackLenseConnect";

/**
 * S3-hosted CFN template URL. Required by AWS Quick Create — arbitrary
 * HTTPS URLs are rejected. Override via NEXT_PUBLIC_CFN_TEMPLATE_URL when
 * we move buckets (e.g. into a dedicated StackLense AWS account).
 */
export const CFN_TEMPLATE_URL =
  process.env.NEXT_PUBLIC_CFN_TEMPLATE_URL ||
  "https://stacklense-cfn-templates.s3.amazonaws.com/connect-stacklense.yaml";

/**
 * Default region we operate in until per-customer regions are wired up.
 * Discovery and EventBridge are us-east-1-pinned for now.
 */
export const DEFAULT_AWS_REGION = "us-east-1";

/**
 * One-click create URL — pre-fills the template and parameter, customer
 * just clicks Create. Used for first-time install.
 */
export function buildQuickCreateUrl(args: {
  webhookToken: string;
  region?: string;
}): string {
  const region = args.region || DEFAULT_AWS_REGION;
  const params = new URLSearchParams({
    templateURL: CFN_TEMPLATE_URL,
    stackName: STACKLENSE_STACK_NAME,
    param_WebhookToken: args.webhookToken,
  });
  return `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/quickcreate?${params.toString()}`;
}

/**
 * Deep link to the customer's existing stack. Uses the stack-list filter
 * pattern because we don't know the stack ARN/ID without calling
 * cloudformation:DescribeStacks (which our read-only role doesn't grant).
 *
 * Customer lands on a one-row stack list, clicks the stack name, then
 * "Update" — at which point they paste the templateURL we display.
 */
export function buildManageStackUrl(args: {
  region?: string;
  stackName?: string;
}): string {
  const region = args.region || DEFAULT_AWS_REGION;
  const stackName = args.stackName || STACKLENSE_STACK_NAME;
  return `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks?filteringText=${encodeURIComponent(
    stackName
  )}&filteringStatus=active&viewNested=true&hideStacks=false`;
}

/**
 * Deep link to the IAM role's permissions tab in the customer's account.
 * Useful when the customer wants to verify the exact policy attached, or
 * troubleshoot AccessDenied errors during discovery.
 */
export function buildIamRoleUrl(args: { accountId: string }): string {
  const roleName = `StackLense-ReadOnly-${args.accountId}`;
  return `https://us-east-1.console.aws.amazon.com/iam/home#/roles/details/${roleName}`;
}

/**
 * Compare the version a customer's stack was last verified against to the
 * current template version. Returns:
 *   "current"  — versions match, no update needed
 *   "outdated" — customer is behind, update banner should show
 *   "unknown"  — we've never recorded a version (legacy or pre-this-feature)
 */
export function compareTemplateVersion(
  storedVersion: string | null
): "current" | "outdated" | "unknown" {
  if (!storedVersion) return "unknown";
  if (storedVersion === CFN_TEMPLATE_VERSION) return "current";
  return "outdated";
}

/**
 * Heuristic: scan the discovery_snapshot.errors[] for AccessDenied-style
 * messages, which usually mean the customer's CFN stack is missing IAM
 * permissions for a service we now try to read. Returns the per-service
 * breakdown so the UI can both show the count and explain what's missing.
 */
export type DiscoveryErrorSummary = {
  total: number;
  accessDenied: Array<{ source: string; message: string }>;
  other: Array<{ source: string; message: string }>;
  hasPermissionGap: boolean;
};

export function summarizeDiscoveryErrors(
  errors: Array<{ source: string; message: string }> | null | undefined
): DiscoveryErrorSummary {
  const list = errors ?? [];
  const accessDenied: Array<{ source: string; message: string }> = [];
  const other: Array<{ source: string; message: string }> = [];
  for (const err of list) {
    const msg = (err.message ?? "").toLowerCase();
    if (
      msg.includes("accessdenied") ||
      msg.includes("not authorized") ||
      msg.includes("is not authorised") ||
      msg.includes("authorization") ||
      msg.includes("explicit deny")
    ) {
      accessDenied.push(err);
    } else {
      other.push(err);
    }
  }
  return {
    total: list.length,
    accessDenied,
    other,
    hasPermissionGap: accessDenied.length > 0,
  };
}
