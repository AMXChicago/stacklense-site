"use client";

/**
 * Project workspace shell. The project page is its own app: a left
 * navigation rail listing the available views, a main pane that swaps
 * content based on the selected view, and a floating user menu in the
 * bottom right for account-level controls.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ ┌────────┐ ┌─────────────────────────────────────────┐   │
 *   │ │  Rail  │ │           Active view                    │   │
 *   │ │ (240)  │ │           (Blueprint by default)         │   │
 *   │ │        │ │                                          │   │
 *   │ │ Project│ │                                          │   │
 *   │ │ name   │ │                                          │   │
 *   │ │ ●Live  │ │                                          │   │
 *   │ │ ────── │ │                                          │   │
 *   │ │ Blueprint │                                          │   │
 *   │ │ List   │ │                                          │   │
 *   │ │ Decisions │                                          │   │
 *   │ │ Risks  │ │                                          │   │
 *   │ │ Inventory │                                          │   │
 *   │ │ ────── │ │                                          │   │
 *   │ │ AWS    │ │                                          │   │
 *   │ │ Updates│ │                                          │   │
 *   │ │ Settings  │                                          │   │
 *   │ └────────┘ └──────────────────────────────────────┌──┐ │
 *   │                                                   │U │ │
 *   └───────────────────────────────────────────────────└──┘─┘
 *
 * Each view is pre-rendered server-side and passed in as a ReactNode
 * prop. The client component just toggles which one is visible (via
 * display: none on the others), so server-only data fetching still
 * works even though view-switching is client-side.
 */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

type ViewKey =
  | "blueprint"
  | "list"
  | "decisions"
  | "risks"
  | "inventory"
  | "aws"
  | "updates"
  | "settings";

type StatusKind = "ok" | "running" | "neutral" | "err";

export function ProjectWorkspaceClient({
  projectName,
  status,
  summary,
  // Each view is a ReactNode pre-rendered by the server component
  // (so it can include both server and client sub-components).
  views,
  counts,
  hasAws,
  userEmail,
  awsNeedsAttention,
  flashes,
  autoRefreshSlot,
}: {
  projectName: string;
  status: { kind: StatusKind; label: string };
  summary?: string | null;
  views: Record<ViewKey, ReactNode>;
  counts: Partial<Record<ViewKey, number>>;
  hasAws: boolean;
  userEmail: string;
  awsNeedsAttention: boolean;
  flashes: ReactNode;
  autoRefreshSlot: ReactNode;
}) {
  const [active, setActive] = useState<ViewKey>("blueprint");

  // The workspace owns the viewport. Add a body class so the global
  // dash-nav and dash-main padding are reliably overridden (plain
  // class selectors are more compatible than :has() across browsers
  // and avoid the scenario where the top dashboard nav stayed visible
  // and ate the workspace's top edge).
  useEffect(() => {
    document.body.classList.add("ws-mode");
    return () => {
      document.body.classList.remove("ws-mode");
    };
  }, []);

  // Build the navigation. Sections separated by `null`, items hidden
  // by `null` value (e.g., AWS view is only relevant for AWS-connected
  // projects).
  const blueprintItems: NavItem[] = [
    { key: "blueprint", label: "Blueprint" },
    { key: "list", label: "List" },
    { key: "decisions", label: "Decisions", count: counts.decisions ?? 0 },
    { key: "risks", label: "Risks", count: counts.risks ?? 0 },
    { key: "inventory", label: "Inventory" },
  ];
  const projectItems: NavItem[] = [
    ...(hasAws
      ? [
          {
            key: "aws" as const,
            label: "AWS connection",
            badge: awsNeedsAttention ? ("warn" as const) : undefined,
          },
        ]
      : []),
    { key: "updates", label: "Recent updates", count: counts.updates ?? 0 },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="proj-ws">
      {autoRefreshSlot}

      <aside className="proj-rail">
        <div className="proj-rail-top">
          <Link href="/dashboard" className="proj-rail-back">
            ← All projects
          </Link>
          <div className="proj-rail-id">
            <h1 className="proj-rail-name">{projectName}</h1>
            <StatusChip status={status} />
          </div>
          {summary && <p className="proj-rail-summary">{summary}</p>}
        </div>

        {flashes && <div className="proj-rail-flashes">{flashes}</div>}

        <nav className="proj-rail-nav" aria-label="Project views">
          <NavSection label="Blueprint">
            {blueprintItems.map((item) => (
              <NavButton
                key={item.key}
                item={item}
                active={active === item.key}
                onClick={() => setActive(item.key)}
              />
            ))}
          </NavSection>

          <NavSection label="Project">
            {projectItems.map((item) => (
              <NavButton
                key={item.key}
                item={item}
                active={active === item.key}
                onClick={() => setActive(item.key)}
              />
            ))}
          </NavSection>
        </nav>
      </aside>

      <main className="proj-main">
        {(Object.keys(views) as ViewKey[]).map((key) => (
          <div
            key={key}
            className="proj-view"
            hidden={active !== key}
            aria-hidden={active !== key}
          >
            {views[key]}
          </div>
        ))}
      </main>

      <UserMenu email={userEmail} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

type NavItem = {
  key: ViewKey;
  label: string;
  count?: number;
  badge?: "warn" | "err";
};

function NavSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="proj-nav-section">
      <p className="proj-nav-section-label">{label}</p>
      <ul className="proj-nav-list">{children}</ul>
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`proj-nav-item ${active ? "proj-nav-item-active" : ""}`}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
      >
        <span className="proj-nav-label">{item.label}</span>
        {item.badge === "warn" && (
          <span
            className="proj-nav-badge proj-nav-badge-warn"
            aria-label="needs attention"
          />
        )}
        {item.count !== undefined && item.count > 0 && (
          <span className="proj-nav-count">{item.count}</span>
        )}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

function StatusChip({
  status,
}: {
  status: { kind: StatusKind; label: string };
}) {
  return (
    <span
      className={`proj-status-chip proj-status-chip-${status.kind}`}
      aria-label={`Blueprint ${status.label}`}
    >
      <span className="proj-status-dot" aria-hidden />
      {status.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// User menu — floating bottom-right account control
// ---------------------------------------------------------------------------

function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const initials = email
    ? email
        .split("@")[0]
        .split(/[._-]+/)
        .map((p) => p[0]?.toUpperCase())
        .filter(Boolean)
        .slice(0, 2)
        .join("")
    : "?";

  return (
    <div className="proj-user-anchor proj-user-anchor-left">
      {open && (
        <>
          <div
            className="proj-user-scrim"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="proj-user-pop proj-user-pop-left" role="menu">
            <div className="proj-user-pop-head">
              <div className="proj-user-pop-avatar">{initials}</div>
              <div className="proj-user-pop-id">
                <p className="proj-user-pop-email">{email}</p>
                <p className="proj-user-pop-role">Account owner</p>
              </div>
            </div>
            <ul className="proj-user-pop-list">
              <li>
                <button
                  type="button"
                  className="proj-user-pop-item proj-user-pop-item-disabled"
                  disabled
                  title="Coming soon"
                >
                  <span>Account settings</span>
                  <span className="proj-user-pop-soon">soon</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="proj-user-pop-item proj-user-pop-item-disabled"
                  disabled
                  title="Coming soon"
                >
                  <span>Billing</span>
                  <span className="proj-user-pop-soon">soon</span>
                </button>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="proj-user-pop-item"
                  onClick={() => setOpen(false)}
                >
                  All projects
                </Link>
              </li>
            </ul>
            <form
              action="/api/auth/signout"
              method="post"
              className="proj-user-pop-form"
            >
              <button type="submit" className="proj-user-pop-signout">
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
      <button
        type="button"
        className={`proj-user-btn ${open ? "proj-user-btn-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="proj-user-btn-avatar">{initials}</span>
      </button>
    </div>
  );
}
