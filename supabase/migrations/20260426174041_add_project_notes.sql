-- User-provided project facts. Free-form text where the user tells
-- StackLense what to know about their stack: AI tools used (Codex,
-- Cursor), domains/registrar, things the source code can't reveal.
-- Fed verbatim to the analysis engine alongside any source it scans.

alter table public.projects
  add column if not exists notes text;
