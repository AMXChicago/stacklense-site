-- Track which phase blueprint generation is in so the project page can
-- show honest progress instead of a fake countdown.
--
-- Shape: { stage: 'starting' | 'reading_sources' | 'asking_claude' | 'finalizing',
--          started_at: timestamptz string }

alter table public.projects
  add column if not exists blueprint_progress jsonb;
