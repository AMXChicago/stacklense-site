import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { waitUntil } from "@vercel/functions";
import { blueprintFailedEmail, sendEmail } from "./email";
import { discoverAwsResources, discoveryToPromptText } from "./aws-discovery";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Build a Supabase client suitable for server-side admin work — uses the
 * service-role key if available so RLS doesn't block the writes we make
 * from webhooks (no user session). Falls back to the publishable key, which
 * works for actions inside an authenticated request.
 */
function adminClient() {
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE ?? SUPABASE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {
          /* admin client doesn't manage cookies */
        },
      },
    }
  );
}

const anthropic = new Anthropic();
// Sonnet 4.5 — current generation as of late 2025 / early 2026.
// Original Sonnet 4 (claude-sonnet-4-20250514) returned 404 in production.
const BLUEPRINT_MODEL = "claude-sonnet-4-5-20250929";

// Hard cap so we don't burn tokens on huge repos.
const MAX_INPUT_CHARS = 200_000;

/**
 * Public entry point. Marks the project as `generating`, then schedules the
 * actual generation work to continue running after the calling request
 * returns (via Vercel's `waitUntil`).
 *
 * Caller pattern:
 *
 *   await kickOffBlueprintGeneration(projectId);
 *   redirect(`/dashboard/${projectId}`);
 *
 * The user's redirect happens in milliseconds; Claude analysis happens
 * over the next 10–30 seconds in the background.
 */
export async function kickOffBlueprintGeneration(projectId: string) {
  const supabase = adminClient();

  // Mark generating up-front so the dashboard reflects state immediately.
  await supabase
    .from("projects")
    .update({
      blueprint_status: "generating",
      blueprint_error: null,
      blueprint_progress: {
        stage: "starting",
        started_at: new Date().toISOString(),
      },
    })
    .eq("id", projectId);

  waitUntil(generateBlueprint(projectId));
}

/**
 * Update the visible phase of in-flight generation so the user sees real
 * progress instead of a fake countdown. `started_at` from the kickoff is
 * preserved so elapsed time keeps ticking.
 */
async function setProgressStage(
  projectId: string,
  stage: "starting" | "reading_sources" | "asking_claude" | "finalizing"
) {
  const supabase = adminClient();
  const { data } = await supabase
    .from("projects")
    .select("blueprint_progress")
    .eq("id", projectId)
    .single();
  const startedAt =
    (data?.blueprint_progress as { started_at?: string } | null)?.started_at ??
    new Date().toISOString();
  await supabase
    .from("projects")
    .update({
      blueprint_progress: { stage, started_at: startedAt },
    })
    .eq("id", projectId);
}

/**
 * Does the actual work. Should never throw — failures are recorded on the
 * project row and the user can re-trigger from the dashboard.
 */
async function generateBlueprint(projectId: string) {
  const supabase = adminClient();

  // Read the prior status BEFORE we change it so we can decide whether
  // to email on failure (only on transitions into 'failed', not on every
  // retry attempt that fails again).
  const { data: priorRow } = await supabase
    .from("projects")
    .select("blueprint_status, user_id, name")
    .eq("id", projectId)
    .single();
  const priorStatus = priorRow?.blueprint_status ?? null;

  try {
    const { data: project, error } = await supabase
      .from("projects")
      .select(
        "id, name, description, notes, git_host, git_repo_full_name, ecr_aws_account_id, ecr_repo_name, ecr_webhook_token"
      )
      .eq("id", projectId)
      .single();
    if (error || !project) throw new Error(error?.message ?? "project not found");

    await setProgressStage(projectId, "reading_sources");
    const sourceContext = await collectSourceContext(project);

    await setProgressStage(projectId, "asking_claude");
    const blueprint = await callClaude(project, sourceContext);

    await setProgressStage(projectId, "finalizing");
    await supabase
      .from("projects")
      .update({
        blueprint,
        blueprint_status: "ready",
        blueprint_generated_at: new Date().toISOString(),
        blueprint_error: null,
        blueprint_progress: null,
      })
      .eq("id", projectId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      `[blueprint] generation failed for project ${projectId}:`,
      message
    );
    await supabase
      .from("projects")
      .update({
        blueprint_status: "failed",
        blueprint_error: message,
        blueprint_progress: null,
      })
      .eq("id", projectId);

    // Only email on a transition INTO failed — don't spam users who hit
    // Regenerate on a project that's already in a failed state.
    if (priorStatus !== "failed" && priorRow?.user_id && priorRow?.name) {
      await sendBlueprintFailedEmail({
        userId: priorRow.user_id,
        projectId,
        projectName: priorRow.name,
        error: message,
      });
    }
  }
}

/**
 * Look up the user's email by their auth user id and send the failure
 * notification. Failures here are logged but never re-thrown — we don't
 * want email problems to corrupt the blueprint pipeline state.
 */
async function sendBlueprintFailedEmail(args: {
  userId: string;
  projectId: string;
  projectName: string;
  error: string;
}) {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase.auth.admin.getUserById(args.userId);
    const email = data?.user?.email;
    if (error || !email) {
      console.warn(
        "[blueprint] could not resolve user email for failure alert:",
        error?.message
      );
      return;
    }
    const tmpl = blueprintFailedEmail({
      projectName: args.projectName,
      projectId: args.projectId,
      error: args.error,
    });
    const result = await sendEmail({
      to: email,
      subject: tmpl.subject,
      html: tmpl.html,
    });
    if (!result.ok) {
      console.warn("[blueprint] failure email did not send:", result.reason);
    }
  } catch (e) {
    console.error(
      "[blueprint] sendBlueprintFailedEmail threw:",
      e instanceof Error ? e.message : String(e)
    );
  }
}

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  git_host: string | null;
  git_repo_full_name: string | null;
  ecr_aws_account_id: string | null;
  ecr_repo_name: string | null;
  ecr_webhook_token: string | null;
};

/**
 * Collect whatever source data we can given the connected sources. For
 * GitHub we fetch a tarball of the repo and pull text out. For ECR-only
 * projects we have no code, so we hand Claude the metadata only.
 */
async function collectSourceContext(project: ProjectRow): Promise<string> {
  const chunks: string[] = [];

  chunks.push(`# Project: ${project.name}\n`);
  if (project.description) {
    chunks.push(`Description: ${project.description}\n`);
  }

  // AWS discovery — for projects connected via ECR, assume the cross-account
  // read role and enumerate real resources. This is StackLense's PRIMARY
  // source of truth: we tell the customer what their stack looks like, not
  // the other way around.
  if (project.ecr_aws_account_id && project.ecr_webhook_token) {
    chunks.push(
      `## What StackLense observed in your AWS account (read-only inspection)\n`
    );
    const discovery = await discoverAwsResources({
      accountId: project.ecr_aws_account_id,
      externalId: project.ecr_webhook_token,
    });
    if ("ok" in discovery && discovery.ok === false) {
      chunks.push(
        `(AWS discovery failed: ${discovery.reason}. ` +
          `If the read-only role isn't installed yet, the customer should ` +
          `update their CloudFormation stack to the latest template.)\n`
      );
    } else if ("account_id" in discovery) {
      chunks.push(discoveryToPromptText(discovery));
      chunks.push("");
    }
  }

  // Optional notes column — kept as a tier-3 fallback for things discovery
  // genuinely can't see (legacy projects with hand-typed context). Not
  // surfaced as a primary user-input path.
  if (project.notes && project.notes.trim()) {
    chunks.push(
      `## Additional context\n\n${project.notes.trim()}\n`
    );
  }

  if (project.git_host === "github" && project.git_repo_full_name) {
    chunks.push(`## GitHub source\n\nRepo: ${project.git_repo_full_name}\n`);
    // For now we just include the README and a few canonical config files.
    // A future iteration can fetch the full tarball, but that's heavier.
    const fileList = [
      "README.md",
      "package.json",
      "Dockerfile",
      "docker-compose.yml",
      "next.config.mjs",
      "next.config.js",
      "vercel.json",
      "supabase/config.toml",
      ".github/workflows/deploy.yml",
      "CLAUDE.md",
      "AGENTS.md",
    ];
    for (const path of fileList) {
      const content = await fetchPublicGitHubFile(
        project.git_repo_full_name,
        path
      );
      if (content) {
        chunks.push(`### ${path}\n\n\`\`\`\n${content}\n\`\`\`\n`);
      }
    }
  }

  if (project.ecr_aws_account_id) {
    chunks.push(
      `## AWS ECR source\n\nAccount: ${project.ecr_aws_account_id}\n` +
        (project.ecr_repo_name ? `Repo: ${project.ecr_repo_name}\n` : "")
    );
  }

  let text = chunks.join("\n");
  if (text.length > MAX_INPUT_CHARS) {
    text = text.slice(0, MAX_INPUT_CHARS) + "\n... [truncated]";
  }
  return text;
}

/**
 * Best-effort fetch of a single file from GitHub via the unauth contents API.
 * Returns null on any failure — generation should keep going even if a
 * specific file isn't there.
 */
async function fetchPublicGitHubFile(
  fullName: string,
  path: string
): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.github.com/repos/${fullName}/contents/${path}`,
      {
        headers: { Accept: "application/vnd.github.raw" },
        // Cache-bust on each generation
        cache: "no-store",
      }
    );
    if (!r.ok) return null;
    const text = await r.text();
    return text.length > 30_000 ? text.slice(0, 30_000) + "\n[truncated]" : text;
  } catch {
    return null;
  }
}

/**
 * Canonical 12-category schema. Every blueprint has all 12 entries (empty
 * components is valid — "we looked, didn't find any" is data). Keeping the
 * shape consistent across projects makes the visual rendering predictable.
 */
const CATEGORIES: Array<{ key: string; label: string; description: string }> = [
  {
    key: "ai_dev_tools",
    label: "AI & dev tools",
    description:
      "AI coding agents, IDE plugins, and config files (CLAUDE.md, AGENTS.md, .cursorrules)",
  },
  {
    key: "source_control",
    label: "Source code",
    description: "Where the code lives (GitHub, GitLab, Bitbucket)",
  },
  {
    key: "application_stack",
    label: "Application stack",
    description: "Framework, language, runtime (Next.js, FastAPI, Rails, Node, Python, etc.)",
  },
  {
    key: "hosting_compute",
    label: "Hosting & compute",
    description:
      "Where the app runs (Vercel, Fly, Railway, AWS ECS/Lambda, GCP, Cloudflare Workers, etc.)",
  },
  {
    key: "data_storage",
    label: "Data & storage",
    description: "Databases, object storage, caches (Supabase, Postgres, S3, R2, Redis)",
  },
  {
    key: "authentication",
    label: "Authentication",
    description: "Auth provider and methods (Supabase Auth, Auth0, Clerk, magic links, OAuth)",
  },
  {
    key: "communications",
    label: "Communications",
    description: "Email, SMS, push (Resend, AWS SES, SendGrid, Twilio, Postmark)",
  },
  {
    key: "domains_dns",
    label: "Domains & DNS",
    description: "Registrar and DNS provider (GoDaddy, Cloudflare, Route 53, Namecheap)",
  },
  {
    key: "payments",
    label: "Payments",
    description: "Payment processor and billing (Stripe, Paddle, Lemon Squeezy)",
  },
  {
    key: "observability",
    label: "Observability",
    description: "Logs, error tracking, analytics (Sentry, PostHog, Datadog, CloudWatch)",
  },
  {
    key: "security_secrets",
    label: "Security & secrets",
    description: "WAF, secret store, certs, IAM (Secrets Manager, WAF, Let's Encrypt)",
  },
  {
    key: "ci_cd",
    label: "CI/CD",
    description:
      "How code gets deployed (GitHub Actions, Vercel auto-deploy, manual scripts, CircleCI)",
  },
];

const SYSTEM_PROMPT = `You are StackLense's analysis engine. Given source files and metadata about a software project, produce a complete, end-to-end blueprint of how the project is built — from AI tools used during development through infrastructure to domain registrar and payment processor.

The audience for the blueprint is mixed: vibe-coder founders with limited technical knowledge, AND experienced engineers. Your descriptions should be plain-English first; specifics and citations are for evidence.

Your output MUST be valid JSON matching this exact shape (no trailing commas, no comments, no markdown fences):

{
  "summary": "1-2 sentences a non-technical reader can understand. What is this project, and what's the headline of how it's built?",
  "categories": [
    {
      "key": "ai_dev_tools" | "source_control" | "application_stack" | "hosting_compute" | "data_storage" | "authentication" | "communications" | "domains_dns" | "payments" | "observability" | "security_secrets" | "ci_cd",
      "label": "string (use the exact label from the category list)",
      "components": [
        {
          "id": "lowercase-slug-unique-per-blueprint",
          "name": "Display name (e.g., 'Vercel', 'AWS ECS Fargate', 'Resend')",
          "vendor": "Company or platform name (e.g., 'Vercel', 'Amazon Web Services', 'Resend')",
          "description": "1-2 plain-English sentences a non-technical user can understand.",
          "evidence": "Where you detected it. File paths, config snippets, or domain names. Concrete.",
          "console_url": "Direct link the user clicks to manage this in the vendor's UI. Use deep links when you can infer the project ID/slug; otherwise root dashboard. Example: https://supabase.com/dashboard/project/xxxxxxx for a specific Supabase project."
        }
      ]
    }
  ],
  "connections": [
    { "from": "<component id>", "to": "<component id>", "label": "Short description of how data/control flows (e.g., 'auto-deploys', 'reads from', 'sends email via')" }
  ],
  "decisions": [
    { "title": "Short title", "category": "arch" | "infra" | "security" | "data" | "ops", "risk": "low" | "medium" | "high", "rationale": "Why this choice was made (inferred or explicit)", "evidence": "What you saw to support this" }
  ],
  "risks": [
    { "title": "Short title", "severity": "info" | "low" | "medium" | "high" | "critical", "description": "What's wrong or risky in plain English", "remediation": "What to do about it" }
  ]
}

REQUIRED RULES:

1. INCLUDE ALL 12 CATEGORIES, even if empty. An empty category has \`"components": []\`. Don't skip.

2. The 12 category keys (in this order) and labels are:
   - ai_dev_tools         "AI & dev tools"
   - source_control       "Source code"
   - application_stack    "Application stack"
   - hosting_compute      "Hosting & compute"
   - data_storage         "Data & storage"
   - authentication       "Authentication"
   - communications       "Communications"
   - domains_dns          "Domains & DNS"
   - payments             "Payments"
   - observability        "Observability"
   - security_secrets     "Security & secrets"
   - ci_cd                "CI/CD"

3. console_url examples — deep-link when possible:
   - Vercel:   https://vercel.com/dashboard
   - GitHub:   https://github.com/<full_name>
   - Supabase: https://supabase.com/dashboard/project/<ref> (or root if no ref)
   - AWS console: https://console.aws.amazon.com/<service>/home?region=<region>
   - Stripe:   https://dashboard.stripe.com
   - Resend:   https://resend.com/domains/<domain>
   - GoDaddy:  https://dcc.godaddy.com/domains
   - Cloudflare: https://dash.cloudflare.com
   If you cannot infer a sensible URL, omit the field.

4. Don't invent components. Only include what the source supports. If you only see hints (e.g., a Stripe webhook URL but no SDK import), still include it but note in evidence it was inferred.

5. Plain English in descriptions. No jargon unless necessary. Write for someone who knows what an app is but not what an EventBridge rule is.

6. Output JSON ONLY. No prose, no markdown fences. The first character must be \`{\` and the last must be \`}\`.`;

async function callClaude(
  project: ProjectRow,
  sourceContext: string
): Promise<unknown> {
  const userPrompt = `Generate a complete blueprint for the following project. Include all 12 categories.\n\n${sourceContext}`;

  const message = await anthropic.messages.create({
    model: BLUEPRINT_MODEL,
    max_tokens: 12000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Analysis engine returned no text content");
  }
  const raw = textBlock.text.trim();

  const json = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  try {
    const parsed = JSON.parse(json);
    return ensureAllCategories(parsed);
  } catch (e) {
    throw new Error(
      `Analysis returned invalid JSON: ${
        e instanceof Error ? e.message : String(e)
      }\n\nFirst 500 chars: ${raw.slice(0, 500)}`
    );
  }
}

/**
 * Belt-and-suspenders: even if the model omits a category despite the prompt,
 * pad the output to the canonical 12 so the renderer always sees a uniform
 * shape.
 */
function ensureAllCategories(parsed: unknown): unknown {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("categories" in parsed) ||
    !Array.isArray((parsed as { categories: unknown }).categories)
  ) {
    return parsed;
  }
  const obj = parsed as {
    categories: Array<{ key?: string; label?: string; components?: unknown[] }>;
  };
  const seen = new Map<string, (typeof obj.categories)[number]>();
  for (const c of obj.categories) {
    if (c && typeof c.key === "string") seen.set(c.key, c);
  }
  obj.categories = CATEGORIES.map((spec) => {
    const existing = seen.get(spec.key);
    if (existing) {
      return {
        key: spec.key,
        label: spec.label,
        components: Array.isArray(existing.components) ? existing.components : [],
      };
    }
    return { key: spec.key, label: spec.label, components: [] };
  });
  return obj;
}
