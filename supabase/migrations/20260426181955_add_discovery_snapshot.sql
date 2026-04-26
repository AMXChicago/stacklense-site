-- Raw output of the last AWS discovery run, kept on the project for the
-- Inventory tab so users can do their own verification pass without us
-- re-calling AWS APIs on every page load.

alter table public.projects
  add column if not exists discovery_snapshot jsonb,
  add column if not exists discovery_at timestamptz;
