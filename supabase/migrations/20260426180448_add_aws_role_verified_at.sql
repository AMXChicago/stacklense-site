-- Track when StackLense successfully assumed the customer's read-only role.
-- Set the first time AssumeRole returns valid creds. Used to drive the
-- "Connected" timeline stage instead of synthetic event hacks.

alter table public.projects
  add column if not exists aws_role_verified_at timestamptz;
