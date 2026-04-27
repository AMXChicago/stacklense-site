/**
 * Static fixture used as the dashboard's known-good Project to
 * render against without hitting the backend.
 *
 * Step 5 expands the fixture to TWO levels deep so the recursive
 * drill-down renderer has real data to exercise. Lambda now
 * contains six functions matching the spec mockup; the formerly
 * lambda-level connections move down to function level so the
 * canvas's edge roll-up rules collapse them back to lambda-level
 * (or AWS-level) edges at higher drill levels.
 *
 *                                ┌─ stripe (webhook back ──┐
 *                                │                          ▼
 *   User ──HTTP──► AWS:Lambda    │
 *                  ├─ createUser ─► AWS:Cognito
 *                  │             └─► AWS:RDS Postgres
 *                  ├─ createOrder ─► AWS:RDS Postgres
 *                  │                ─► Anthropic API     (sync — AI item descriptions)
 *                  │                ─► processPayment    (internal Lambda edge)
 *                  ├─ processPayment ─► Stripe           (sync — charges)
 *                  ├─ processRefund ─► Stripe            (sync — refunds)
 *                  ├─ sendReceipt ──async──► AWS:SES
 *                  └─ uploadAvatar ─► AWS:S3
 *
 * Top-level (rootServiceIds): User, AWS, Stripe, Anthropic API.
 * Inside AWS: Lambda, RDS Postgres, S3, Cognito, SES.
 * Inside Lambda: createUser, createOrder, processPayment,
 *                processRefund, sendReceipt, uploadAvatar.
 *
 * Why this shape lights up roll-up at every level
 * ───────────────────────────────────────────────
 *   ROOT view (drillStack = []):
 *     visible = user, aws, stripe, anthropic
 *     Function→AWS-sibling edges (createUser→cognito, etc.) all
 *     roll up to aws→aws → self-loop → dropped. Function→external
 *     edges roll up to aws→stripe and aws→anthropic. user→lambda
 *     rolls up to user→aws. stripe→lambda rolls up to stripe→aws.
 *     Final root edges: user→aws, aws→stripe, aws→anthropic,
 *     stripe→aws.
 *
 *   AWS-INTERIOR view (drillStack = ["aws"]):
 *     visible = lambda, postgres, s3, cognito, ses
 *     Function→AWS-sibling edges roll up to lambda→sibling →
 *     surface as direct edges. External edges drop (their other
 *     end is no longer visible). Final: lambda→cognito,
 *     lambda→postgres, lambda→s3, lambda→ses.
 *
 *   LAMBDA-INTERIOR view (drillStack = ["aws","lambda"]):
 *     visible = the six functions
 *     Only function-to-function edges survive
 *     (createOrder→processPayment). Everything else has at least
 *     one endpoint outside the visible set → dropped.
 *
 * Two services have `lastChangedAt` set within the past 7 days so
 * the change indicator (orange dot, top-left of node) is exercised.
 *
 * `status` is "unknown" everywhere — live status indicators are
 * wired up in spec build step 11.
 *
 * `metrics` is empty everywhere — Metric Providers are wired up in
 * spec build steps 11+.
 */

import type { Project } from "@/lib/types";

const NOW_MS = Date.now();
const NOW = new Date(NOW_MS).toISOString();
const ONE_DAY_AGO = new Date(NOW_MS - 1 * 86_400_000).toISOString();
const THREE_DAYS_AGO = new Date(NOW_MS - 3 * 86_400_000).toISOString();

// ── Activity timestamps (step 7) ─────────────────────────────────
// Spread across the past week so the relative-time formatter
// exercises every range (minutes, hours, days). Sorted desc by
// timestamp below.
const TWO_MIN_AGO = new Date(NOW_MS - 2 * 60_000).toISOString();
const FOURTEEN_MIN_AGO = new Date(NOW_MS - 14 * 60_000).toISOString();
const TWO_HOURS_AGO = new Date(NOW_MS - 2 * 3_600_000).toISOString();
const SIX_HOURS_AGO = new Date(NOW_MS - 6 * 3_600_000).toISOString();
const TWO_DAYS_AGO = new Date(NOW_MS - 2 * 86_400_000).toISOString();
const ONE_WEEK_AGO = new Date(NOW_MS - 7 * 86_400_000).toISOString();

export const SAMPLE_PROJECT: Project = {
  id: "sample-project",
  name: "Sample Web App",
  rootServiceIds: ["user", "aws", "stripe", "anthropic"],
  services: {
    // ── Top-level services ────────────────────────────────────────
    user: {
      id: "user",
      name: "User",
      kind: "service",
      parentId: null,
      description: "End-user browsers and mobile clients.",
      status: "unknown",
      metadata: {},
      metrics: [],
      createdAt: NOW,
    },
    aws: {
      id: "aws",
      name: "AWS",
      kind: "platform",
      parentId: null,
      description: "Compute, data, and supporting infrastructure.",
      status: "unknown",
      metadata: { brandColor: "#ff9900" },
      metrics: [],
      createdAt: NOW,
    },
    stripe: {
      id: "stripe",
      name: "Stripe",
      kind: "platform",
      parentId: null,
      description: "Payment processing.",
      status: "unknown",
      metadata: { brandColor: "#635bff" },
      metrics: [],
      lastChangedAt: ONE_DAY_AGO,
      createdAt: NOW,
    },
    anthropic: {
      id: "anthropic",
      name: "Anthropic API",
      kind: "platform",
      parentId: null,
      description: "Claude AI calls.",
      status: "unknown",
      metadata: { brandColor: "#d97757" },
      metrics: [],
      createdAt: NOW,
    },

    // ── Children of AWS ───────────────────────────────────────────
    lambda: {
      id: "lambda",
      name: "Lambda",
      kind: "service",
      parentId: "aws",
      description: "Serverless function hosting.",
      status: "unknown",
      metadata: {},
      metrics: [],
      lastChangedAt: THREE_DAYS_AGO,
      createdAt: NOW,
    },
    postgres: {
      id: "postgres",
      name: "RDS Postgres",
      kind: "service",
      parentId: "aws",
      description: "Primary application database.",
      status: "unknown",
      metadata: {},
      metrics: [],
      createdAt: NOW,
    },
    s3: {
      id: "s3",
      name: "S3",
      kind: "service",
      parentId: "aws",
      description: "Object storage for user uploads.",
      status: "unknown",
      metadata: {},
      metrics: [],
      createdAt: NOW,
    },
    cognito: {
      id: "cognito",
      name: "Cognito",
      kind: "service",
      parentId: "aws",
      description: "User identity and authentication.",
      status: "unknown",
      metadata: {},
      metrics: [],
      createdAt: NOW,
    },
    ses: {
      id: "ses",
      name: "SES",
      kind: "service",
      parentId: "aws",
      description: "Transactional email.",
      status: "unknown",
      metadata: {},
      metrics: [],
      createdAt: NOW,
    },

    // ── Lambda function children (step 5: recursive drill-down) ──
    // Six handlers mirroring the spec's mockup. Each is `kind:
    // "function"` so the renderer can later distinguish leaf
    // functions from drillable services if it needs to. None has
    // children (functions are leaves in this fixture).
    createUser: {
      id: "createUser",
      name: "createUser",
      kind: "function",
      parentId: "lambda",
      description: "Provision a new user record + identity entry.",
      status: "unknown",
      metadata: { file: "src/handlers/createUser.ts", lines: 64 },
      metrics: [],
      createdAt: NOW,
    },
    createOrder: {
      id: "createOrder",
      name: "createOrder",
      kind: "function",
      parentId: "lambda",
      description: "Create a new order, generate item description, charge.",
      status: "unknown",
      metadata: { file: "src/handlers/createOrder.ts", lines: 88 },
      metrics: [],
      lastChangedAt: ONE_DAY_AGO,
      createdAt: NOW,
    },
    processPayment: {
      id: "processPayment",
      name: "processPayment",
      kind: "function",
      parentId: "lambda",
      description: "Charge the customer's payment method via Stripe.",
      status: "unknown",
      metadata: { file: "src/handlers/processPayment.ts", lines: 47 },
      metrics: [],
      createdAt: NOW,
    },
    processRefund: {
      id: "processRefund",
      name: "processRefund",
      kind: "function",
      parentId: "lambda",
      description: "Reverse a charge via Stripe and update the order.",
      status: "unknown",
      metadata: { file: "src/handlers/processRefund.ts", lines: 52 },
      metrics: [],
      createdAt: NOW,
    },
    sendReceipt: {
      id: "sendReceipt",
      name: "sendReceipt",
      kind: "function",
      parentId: "lambda",
      description: "Email an order receipt asynchronously.",
      status: "unknown",
      metadata: { file: "src/handlers/sendReceipt.ts", lines: 31 },
      metrics: [],
      createdAt: NOW,
    },
    uploadAvatar: {
      id: "uploadAvatar",
      name: "uploadAvatar",
      kind: "function",
      parentId: "lambda",
      description: "Upload a user avatar to S3.",
      status: "unknown",
      metadata: { file: "src/handlers/uploadAvatar.ts", lines: 28 },
      metrics: [],
      lastChangedAt: THREE_DAYS_AGO,
      createdAt: NOW,
    },
  },
  connections: {
    // ── Boundary edges (still attached to lambda as a whole) ──
    // These represent ingress/egress points where the granularity
    // is the platform-shaped service rather than a specific function.
    "user-lambda": {
      id: "user-lambda",
      fromServiceId: "user",
      toServiceId: "lambda",
      type: "sync",
      what: "HTTP API requests.",
      // Step 6: schema/frequency/latency populated for three edges
      // so the edge-inspector tabs (Schema, Stats) have content. The
      // payload is illustrative — once step 16 wires up live data,
      // it'll come from the introspection layer.
      schema: `POST /api/orders\n{\n  "items": [{"sku": "ABC-123", "qty": 2}],\n  "couponCode": "WELCOME10"\n}`,
      frequency: "~12.4k/day",
      latency: "180ms p99",
      createdAt: NOW,
    },
    "stripe-lambda": {
      id: "stripe-lambda",
      fromServiceId: "stripe",
      toServiceId: "lambda",
      type: "webhook",
      what: "Payment lifecycle events.",
      createdAt: NOW,
    },

    // ── Function-level connections (step 5) ──
    // Each connects a specific Lambda function to its real
    // dependency. The canvas's edge roll-up rules collapse these
    // back to lambda-level edges when viewing AWS-interior, and
    // back to AWS-level edges when viewing the project root.
    "createUser-cognito": {
      id: "createUser-cognito",
      fromServiceId: "createUser",
      toServiceId: "cognito",
      type: "sync",
      what: "Creates the identity record.",
      createdAt: NOW,
    },
    "createUser-postgres": {
      id: "createUser-postgres",
      fromServiceId: "createUser",
      toServiceId: "postgres",
      type: "sync",
      what: "Inserts the user row.",
      createdAt: NOW,
    },
    "createOrder-postgres": {
      id: "createOrder-postgres",
      fromServiceId: "createOrder",
      toServiceId: "postgres",
      type: "sync",
      what: "Inserts the order row.",
      createdAt: NOW,
    },
    "createOrder-anthropic": {
      id: "createOrder-anthropic",
      fromServiceId: "createOrder",
      toServiceId: "anthropic",
      type: "sync",
      what: "Generates an AI item description.",
      createdAt: NOW,
    },
    // Internal Lambda edge — function-to-function. Demonstrates
    // that the Lambda-interior drill view has at least one
    // visible edge (everything else has a non-Lambda endpoint).
    "createOrder-processPayment": {
      id: "createOrder-processPayment",
      fromServiceId: "createOrder",
      toServiceId: "processPayment",
      type: "sync",
      what: "Charges the customer for the new order.",
      createdAt: NOW,
    },
    "processPayment-stripe": {
      id: "processPayment-stripe",
      fromServiceId: "processPayment",
      toServiceId: "stripe",
      type: "sync",
      what: "Creates a Stripe charge.",
      schema: `POST https://api.stripe.com/v1/charges\namount=2099&currency=usd&source=tok_visa`,
      frequency: "~340/day",
      latency: "210ms p99",
      createdAt: NOW,
    },
    "processRefund-stripe": {
      id: "processRefund-stripe",
      fromServiceId: "processRefund",
      toServiceId: "stripe",
      type: "sync",
      what: "Issues a Stripe refund.",
      createdAt: NOW,
    },
    "sendReceipt-ses": {
      id: "sendReceipt-ses",
      fromServiceId: "sendReceipt",
      toServiceId: "ses",
      type: "async",
      what: "Sends the receipt email.",
      schema: `SES SendEmail (queued via SQS)\n{\n  "to": "user@example.com",\n  "template": "order-receipt",\n  "data": { "orderId": "ord_42" }\n}`,
      frequency: "~410/day",
      latency: "≤ 2s end-to-end",
      createdAt: NOW,
    },
    "uploadAvatar-s3": {
      id: "uploadAvatar-s3",
      fromServiceId: "uploadAvatar",
      toServiceId: "s3",
      type: "sync",
      what: "Uploads the avatar object.",
      createdAt: NOW,
    },
  },
  // ── Activity feed (step 7) ─────────────────────────────────────
  // Sorted descending by timestamp per the spec's Project type.
  // Summary uses a tiny markdown subset:
  //   **bold**         → service / platform names
  //   `code`           → version numbers, columns, function names
  //                      that are best read in monospace
  // ActivityItem.tsx parses this. Detail strings are plain prose
  // for the future "diff inspector" (step 8).
  activity: [
    {
      id: "act-added-processRefund",
      kind: "add",
      summary: "added **processRefund** function",
      detail:
        "New Lambda handler accepts a charge ID and issues a refund via the Stripe API. Wired to a new POST /refunds route.",
      affectedServiceIds: ["processRefund"],
      affectedConnectionIds: ["processRefund-stripe"],
      timestamp: TWO_MIN_AGO,
      source: "git",
    },
    {
      id: "act-new-edge-anthropic",
      kind: "edge",
      summary: "new edge detected: **createOrder** → **Anthropic API**",
      detail:
        "createOrder now calls Claude to generate item descriptions. First observed via the introspection layer 14 minutes ago.",
      affectedServiceIds: ["createOrder", "anthropic"],
      affectedConnectionIds: ["createOrder-anthropic"],
      timestamp: FOURTEEN_MIN_AGO,
      source: "introspection",
    },
    {
      id: "act-deployed-2-4-1",
      kind: "deploy",
      summary: "deployed `v2.4.1` to **Lambda**",
      detail:
        "Rolled forward from v2.4.0 — fixes the race in processPayment. All six handlers redeployed.",
      affectedServiceIds: [
        "lambda",
        "createUser",
        "createOrder",
        "processPayment",
        "processRefund",
        "sendReceipt",
        "uploadAvatar",
      ],
      affectedConnectionIds: [],
      timestamp: TWO_HOURS_AGO,
      source: "github-actions",
    },
    {
      id: "act-stripe-webhook",
      kind: "config",
      summary: "configured **Stripe** webhook endpoint",
      detail:
        "Stripe → Lambda webhook now receives charge.succeeded, charge.failed, charge.refunded events. Signature verification enabled.",
      affectedServiceIds: ["stripe", "lambda"],
      affectedConnectionIds: ["stripe-lambda"],
      timestamp: SIX_HOURS_AGO,
      source: "stripe-cli",
    },
    {
      id: "act-createUser-schema",
      kind: "change",
      summary:
        "**createUser** schema migration: added `phone` column",
      detail:
        "Added an optional phone field to the user record. Backfill scheduled for off-peak hours.",
      affectedServiceIds: ["createUser", "postgres"],
      affectedConnectionIds: ["createUser-postgres"],
      timestamp: ONE_DAY_AGO,
      source: "git",
    },
    {
      id: "act-cognito-mfa",
      kind: "config",
      summary: "enabled **MFA** on **Cognito**",
      detail:
        "All new sign-ups require TOTP verification. Existing users are prompted on next login.",
      affectedServiceIds: ["cognito"],
      affectedConnectionIds: [],
      timestamp: TWO_DAYS_AGO,
      source: "aws-console",
    },
    {
      id: "act-removed-sendOldReceipt",
      kind: "remove",
      summary: "removed **sendOldReceipt** handler",
      detail:
        "Legacy email handler retired in favour of sendReceipt. Subscription deleted from the SES topic.",
      affectedServiceIds: [],
      affectedConnectionIds: [],
      timestamp: THREE_DAYS_AGO,
      source: "git",
    },
    {
      id: "act-rolled-back-2-4-0",
      kind: "deploy",
      summary:
        "rolled back `v2.4.0` (regression in **processPayment**)",
      detail:
        "v2.4.0 introduced a duplicate-charge edge case under high load. Rolled back to v2.3.7 within 18 minutes of detection.",
      affectedServiceIds: ["processPayment", "lambda"],
      affectedConnectionIds: [],
      timestamp: ONE_WEEK_AGO,
      source: "github-actions",
    },
  ],
};
