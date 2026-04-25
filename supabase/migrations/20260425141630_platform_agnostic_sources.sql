-- ============================================================================
-- Platform-agnostic project sources
-- ============================================================================
-- The original schema baked in AWS-specific columns on `projects`. StackLense
-- is platform-agnostic: a project can be connected via a Git host (currently
-- GitHub), via a container registry (currently AWS ECR), or both. Each source
-- contributes data to the blueprint generation pipeline.
--
-- This migration:
--   1. Drops the AWS-coupled columns from `projects`
--   2. Adds two source-specific column groups (git_* and ecr_*)
--   3. Adds a `blueprint` JSONB column for the generated artifact
--   4. Adds a `blueprint_status` enum-like text column for pipeline state
--   5. Adds `source_type` to `deploys` so we can tell where each event came from
--
-- It's safe to apply: the old columns weren't populated yet (no real users).

-- ----------------------------------------------------------------------------
-- 1. PROJECTS
-- ----------------------------------------------------------------------------

alter table public.projects
  drop column if exists aws_account_id,
  drop column if exists ecr_repo,
  drop column if exists blueprint_s3_bucket;

alter table public.projects
  -- GitHub source (nullable — project may not have one)
  add column if not exists git_host text,
  add column if not exists git_repo_full_name text,
  add column if not exists git_repo_id bigint,
  add column if not exists git_webhook_secret text,
  add column if not exists git_webhook_id bigint,

  -- AWS ECR source (nullable — project may not have one)
  add column if not exists ecr_aws_account_id text,
  add column if not exists ecr_repo_name text,
  add column if not exists ecr_webhook_token text,

  -- Generated blueprint
  add column if not exists blueprint jsonb,
  add column if not exists blueprint_status text not null default 'pending',
  add column if not exists blueprint_generated_at timestamptz,
  add column if not exists blueprint_error text;

-- Constraint: blueprint_status must be one of these values
alter table public.projects
  drop constraint if exists projects_blueprint_status_check;
alter table public.projects
  add constraint projects_blueprint_status_check
  check (blueprint_status in ('pending', 'generating', 'ready', 'failed'));

-- Indexes for webhook lookup (token-based, fast). Partial indexes so only
-- rows with a token are indexed.
create index if not exists projects_git_repo_full_name_idx
  on public.projects (git_repo_full_name)
  where git_repo_full_name is not null;

create unique index if not exists projects_ecr_webhook_token_uniq
  on public.projects (ecr_webhook_token)
  where ecr_webhook_token is not null;

-- ----------------------------------------------------------------------------
-- 2. DEPLOYS
-- ----------------------------------------------------------------------------

alter table public.deploys
  add column if not exists source_type text not null default 'unknown',
  add column if not exists payload jsonb;

alter table public.deploys
  drop constraint if exists deploys_source_type_check;
alter table public.deploys
  add constraint deploys_source_type_check
  check (source_type in ('github', 'ecr', 'unknown'));
