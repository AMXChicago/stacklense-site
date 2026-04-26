-- Track each customer's installed CloudFormation template version, the AWS
-- region they're operating in, and the last time we actively verified the
-- read-only role. These power the "Update AWS connection" banner and the
-- manual "Test connection" button on the project dashboard.
--
-- cfn_template_version: matches CFN_TEMPLATE_VERSION in lib/cfn.ts. Stamped
--   when a discovery run completes with no permission errors (i.e., the
--   stack actually has all the perms the current template grants).
--
-- aws_region: customer's primary AWS region, populated from the discovery
--   snapshot. Used to deep-link to the right CloudFormation/IAM consoles.
--
-- aws_role_last_checked_at: every successful or failed AssumeRole attempt
--   updates this. Distinct from aws_role_verified_at (which records the
--   last SUCCESSFUL verification) so we can tell "we tried recently and it
--   failed" from "we haven't checked in days".

alter table public.projects
  add column if not exists cfn_template_version text,
  add column if not exists aws_region text,
  add column if not exists aws_role_last_checked_at timestamptz;
