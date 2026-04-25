-- ============================================================================
-- StackLense — initial schema
-- ============================================================================
-- Three tables: waitlist (public signups), projects (per-user), deploys (per-project).
-- Row Level Security (RLS) is enabled on all three so the database itself
-- enforces who can see/edit what — independent of any app-level checks.

-- ----------------------------------------------------------------------------
-- 1. WAITLIST
-- ----------------------------------------------------------------------------
-- Public signup form on the landing page. Anonymous visitors can INSERT.
-- Nobody can SELECT/UPDATE/DELETE through the public API — you read it in the
-- Supabase dashboard, or with the service_role key from a secure backend.

create table public.waitlist (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null,
  created_at  timestamptz not null default now(),
  source      text                                      -- 'hero' or 'footer'
);

-- Prevent duplicate signups (same email twice).
create unique index waitlist_email_unique
  on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- Anyone (anon or authenticated) can add themselves to the waitlist.
create policy "anyone can insert into waitlist"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);

-- (No SELECT/UPDATE/DELETE policies → those operations are blocked for
--  anon/authenticated. service_role bypasses RLS, so admin reads still work.)


-- ----------------------------------------------------------------------------
-- 2. PROJECTS
-- ----------------------------------------------------------------------------
-- A user's connected projects (their MSP-Lighthouse-like apps that StackLense
-- watches). Each project belongs to exactly one user.

create table public.projects (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users (id) on delete cascade,
  name                text        not null,
  description         text,
  aws_account_id      text,
  ecr_repo            text,
  blueprint_s3_bucket text,
  connected_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Index for the most common query: "give me all projects for user X".
create index projects_user_id_idx on public.projects (user_id);

alter table public.projects enable row level security;

-- A logged-in user can only see/edit their own projects.
-- auth.uid() returns the current user's UUID inside any RLS policy.

create policy "users can read their own projects"
  on public.projects
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert their own projects"
  on public.projects
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can update their own projects"
  on public.projects
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their own projects"
  on public.projects
  for delete
  to authenticated
  using (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 3. DEPLOYS
-- ----------------------------------------------------------------------------
-- One row per deploy event. Each deploy belongs to a project, which in turn
-- belongs to a user — so we cascade ownership through the project FK.

create table public.deploys (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects (id) on delete cascade,
  image_tag   text,
  deploy_note text,
  created_at  timestamptz not null default now()
);

-- Composite index: typical query is "list deploys for project X, newest first".
create index deploys_project_id_created_at_idx
  on public.deploys (project_id, created_at desc);

alter table public.deploys enable row level security;

-- A user can read/insert deploy rows only for projects they own.
-- The EXISTS subquery checks the projects table — Postgres re-evaluates per row.

create policy "users can read deploys for their projects"
  on public.deploys
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = deploys.project_id
        and p.user_id = auth.uid()
    )
  );

create policy "users can insert deploys for their projects"
  on public.deploys
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = deploys.project_id
        and p.user_id = auth.uid()
    )
  );

-- (No UPDATE/DELETE policies on deploys — they're an immutable audit log.
--  If we ever need to fix one, we go in via service_role.)


-- ----------------------------------------------------------------------------
-- 4. AUTO-UPDATE projects.updated_at
-- ----------------------------------------------------------------------------
-- Trigger that keeps projects.updated_at in sync whenever a project is updated.

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();
