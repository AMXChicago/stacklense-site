-- Auto-verify timestamp.
--
-- Set the first time we automatically fire a synthetic event for a project
-- to verify the wiring without the user having to click anything. Used by
-- the project detail page to dedupe — once attempted, we don't auto-retry
-- for at least an hour.

alter table public.projects
  add column if not exists auto_verify_at timestamptz;
