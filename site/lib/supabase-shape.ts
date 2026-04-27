/**
 * Raw Supabase row shapes — what we actually read from the database.
 * Consumed ONLY by lib/project-adapter.ts. No other file in the
 * frontend should import from here.
 *
 * If the database schema changes, update these types and the
 * adapter. The rest of the frontend keeps working because it
 * consumes the spec's Project shape (lib/types.ts) via the adapter.
 *
 * These match the columns selected in the legacy
 * app/(workspace)/dashboard/[projectId]/page.tsx — preserved so the
 * adapter has documented inputs to work from.
 */

export type ProjectRow = {
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
  blueprint: BlueprintBlob | null;
  blueprint_status: "pending" | "generating" | "ready" | "failed";
  blueprint_generated_at: string | null;
  blueprint_error: string | null;
  blueprint_progress: BlueprintProgressBlob | null;
  auto_verify_at: string | null;
  aws_role_verified_at: string | null;
  aws_role_last_checked_at: string | null;
  aws_region: string | null;
  cfn_template_version: string | null;
  discovery_snapshot: DiscoverySnapshotBlob | null;
  discovery_at: string | null;
};

/**
 * The LLM-generated blueprint stored in projects.blueprint (jsonb).
 * Categorical, not recursive — the adapter is responsible for
 * synthesising the recursive Service tree from this.
 */
export type BlueprintBlob = {
  summary?: string;
  categories?: BlueprintCategory[];
  connections?: BlueprintEdge[];
  decisions?: BlueprintDecision[];
  risks?: BlueprintRisk[];
};

export type BlueprintCategory = {
  key: string;
  label: string;
  components: BlueprintComponent[];
};

export type BlueprintComponent = {
  id: string;
  name: string;
  vendor?: string;
  description: string;
  evidence?: string;
  console_url?: string;
};

export type BlueprintEdge = {
  from: string;
  to: string;
  label?: string;
};

export type BlueprintDecision = {
  title: string;
  category: string;
  risk: string;
  rationale: string;
  evidence?: string;
};

export type BlueprintRisk = {
  title: string;
  severity: string;
  description: string;
  remediation?: string;
};

export type BlueprintProgressBlob = {
  stage: "starting" | "reading_sources" | "asking_claude" | "finalizing";
  started_at: string;
};

/**
 * Raw AWS introspection output stored in projects.discovery_snapshot
 * (jsonb). Open-ended bag of per-service inventories. The adapter
 * maps these into Service nodes tagged with `kind: "service"` under
 * the AWS platform.
 */
export type DiscoverySnapshotBlob = {
  account_id?: string;
  region?: string;
  errors?: Array<{ source: string; message: string }>;
  // The discovery layer adds keys like ecr_repos, ecs_clusters,
  // s3_buckets, lambda_functions, rds_instances, etc. Open-ended on
  // purpose — adapter handles each known key explicitly.
  [key: string]: unknown;
};

export type DeployRow = {
  id: string;
  image_tag: string | null;
  deploy_note: string | null;
  created_at: string;
  source_type: "ecr" | "github" | string;
};
