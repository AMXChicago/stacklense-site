# Step 5 — Auth + Connect Flow

## Outcome

A user can land on stacklense.com → sign up (email magic link **or** GitHub OAuth) → land on a protected `/dashboard` → click **Connect Project** → choose GitHub-repo path or AWS-account path → see their first project listed in the dashboard.

## Split into two sub-steps

The original spec conflates "auth" with "connect flow." They're different surfaces; separating makes the work shippable in chunks.

- **5a — Auth foundation**: signup/login UI, magic links, GitHub OAuth, callback handler, session middleware, protected `/dashboard` skeleton.
- **5b — Connect flow**: dashboard "Connect Project" UI, GitHub repo picker, AWS Connect (CloudFormation template), `projects` row insert.

Ship 5a first. Verify it on a Vercel preview. Then 5b on top.

---

## 5a — Auth foundation

### Routes

```
/                       (existing landing — unchanged)
/login                  email + GitHub OAuth (single page, both options)
/auth/callback          OAuth return handler — exchanges code for session
/auth/confirm           magic-link return handler
/dashboard              protected — redirects to /login if no session
/api/auth/signout       POST — server-side signout
```

### Auth methods exposed

| Method        | Flow                                                                                  | UX                                          |
| ------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| Email magic   | User types email → Supabase emails a one-click sign-in link → click → logged in       | Zero passwords, zero friction               |
| GitHub OAuth  | User clicks "Sign in with GitHub" → GitHub authorizes → return → logged in            | Familiar; also pre-fetches a GitHub session for the Connect flow later |

We're **not** building password auth. Magic links cover the email use case with less friction and no password-reset surface area.

### Session model

Supabase issues a JWT in an httpOnly cookie. Next.js middleware (`middleware.ts` in repo root) refreshes the session on every request via the `utils/supabase/middleware.ts` we already wrote. On protected routes, server components check `supabase.auth.getUser()`; if null → redirect to `/login`.

### Files to create / modify

```
site/middleware.ts                         NEW — wires up session refresh on every request
site/app/login/page.tsx                    NEW — login UI with both auth options
site/app/login/actions.ts                  NEW — server actions (magic link send, GitHub OAuth)
site/app/auth/callback/route.ts            NEW — OAuth code exchange
site/app/auth/confirm/route.ts             NEW — magic link token exchange
site/app/dashboard/page.tsx                NEW — placeholder dashboard, protected
site/app/dashboard/layout.tsx              NEW — sidebar/topbar shell, signout button
site/app/api/auth/signout/route.ts         NEW — POST handler
site/app/page.tsx                          MOD — nav "Get early access" link → `/login` when not signed in, → `/dashboard` when signed in
```

### Style

Reuse the landing page's design system (CSS variables in `globals.css`). The login page should feel like a continuation of the landing — same dark canvas, Geist sans, Instrument Serif headlines, green accents. No second design system.

### Verification

- Magic link: type email on /login → check inbox → click → land on /dashboard
- GitHub: click "Sign in with GitHub" → authorize → land on /dashboard
- Logout: click → cookie cleared → /dashboard redirects to /login
- Direct hit on /dashboard with no session → redirect to /login

---

## 5b — Connect flow

### UI

`/dashboard` shows:

- If no projects: a centered "Connect your first project" card with two options
- If projects exist: a list of `projects` rows + a "Connect another" button at the top

### Two connect paths

#### Path A — GitHub repo

Uses the GitHub OAuth session we already have from 5a (or prompts for it if signed in via email). Reads the user's repos via `GET https://api.github.com/user/repos`. Shows a searchable list. User picks one.

Behind the scenes:

1. We extract `aws_account_id` and `ecr_repo` from the repo's deploy config (best-effort — many repos won't have it explicitly; we infer or prompt)
2. Insert a row into `projects`
3. Generate a placeholder blueprint (we'll wire real generation in a later step)
4. Redirect to `/dashboard/<project_id>`

GitHub OAuth scope: we'll need to add `repo` scope on top of the basic `read:user` to list user's private repos. This is set when registering the OAuth app; we may need to update scopes in Supabase's GitHub provider config.

#### Path B — AWS account

User enters their AWS account ID. We generate a CloudFormation **Quick Create Stack** URL pre-filled with:

- IAM role for StackLense to assume (read-only on ECS/ECR/S3/CloudWatch)
- EventBridge rule for ECR pushes → forwards to our central Lambda (the one already running for MSP Lighthouse, generalized to multi-tenant)
- An external ID parameter to prevent confused-deputy attacks

The user clicks the URL → AWS console opens → they click "Create Stack" → IAM role and EventBridge rule are created in their account → CloudFormation outputs the role ARN → user pastes role ARN back in our UI → we insert into `projects` row.

The CloudFormation YAML lives at `aws/connect-stacklense.yaml` in the repo, served from `/aws/connect-stacklense.yaml` as a public asset.

### Files to create

```
site/app/dashboard/page.tsx                MOD — list projects, "Connect" CTA
site/app/dashboard/connect/page.tsx        NEW — chooser between GitHub / AWS
site/app/dashboard/connect/github/page.tsx NEW — repo picker
site/app/dashboard/connect/aws/page.tsx    NEW — account ID + role ARN entry
site/app/dashboard/[projectId]/page.tsx    NEW — project detail (placeholder)
site/app/api/connect/github/route.ts       NEW — repo list + insert handler
site/app/api/connect/aws/route.ts          NEW — verify role + insert handler
aws/connect-stacklense.yaml                NEW — CloudFormation template
site/public/aws/connect-stacklense.yaml    NEW — same file, served as public asset
```

### Verification

- Click "Connect Project" with no projects → see chooser
- GitHub path: see your repos, pick one, see it appear in dashboard list
- AWS path: enter account ID → click generated link → AWS console opens with prefilled stack → create → paste role ARN → see project in dashboard

---

## Order of execution

1. **5a, day 1**: branch `step-5a-auth` → all auth files → push → Vercel preview → manual test → merge to main
2. **5b, day 2**: branch `step-5b-connect` → connect flow + CFN template → push → Vercel preview → manual test → merge to main

Each branch is independently deployable and reviewable.

---

## Things I need from you (in order)

### Now (one-time, if not done already)

- [x] GitHub OAuth App registered, credentials in Supabase
- [x] Supabase site URL + redirect URLs configured
- [ ] **Brief approval of this plan** — flag anything you want different before I start writing code
- [ ] **Decision on email provider** — Supabase ships with built-in magic-link email but it's rate-limited and uses Supabase's domain. For production launch you'll want SES or similar. Use Supabase default for now? (Recommendation: **yes** for 5a; revisit before public launch.)

### Later (during 5b)

- [ ] AWS resource design review — I'll propose the IAM permissions for the role; you confirm scope before I codify in CloudFormation
- [ ] Generalize the existing MSP Lighthouse Lambda webhook to accept multi-tenant ECR pushes (separate task)

---

## What stays out of scope for Step 5

- Real blueprint generation (placeholder only)
- Decision log + risk flags (Step 6)
- Architecture diagram (Step 6)
- PDF / shareable export (Step 6)
- Multi-tenant Lambda generalization (separate, Step 5b prereq)
- Custom email templates / domains
- Org / team support (single-user only for now)

---

## Definition of done for Step 5

- [ ] Logged-out user lands on `/` → can sign up via magic link or GitHub
- [ ] Logged-in user lands on `/dashboard` and sees their projects
- [ ] User can connect a GitHub repo → row appears
- [ ] User can connect an AWS account via CloudFormation → row appears
- [ ] Logout works
- [ ] All routes have proper auth gating
- [ ] All work merged to `main`, deployed to stacklense.com, manually verified

When this is true, we move to Step 6 (Dashboard).
