"use client";

/**
 * Project workspace shell — full-viewport application.
 *
 * No CSS tricks, no `position: fixed` overrides, no body class
 * hacks. The (workspace) route group has its own layout with NO
 * dashboard nav, so the workspace fills the viewport naturally with
 * normal flexbox.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ ┌────────────┐ ┌─────────────────────────────────────┐  │
 *   │ │   Rail     │ │       Active view header            │  │
 *   │ │  (260px)   │ │ ─────────────────────────────────── │  │
 *   │ │ ┌─Header─┐ │ │                                     │  │
 *   │ │ │ ←Back  │ │ │       Active view body              │  │
 *   │ │ │ Project│ │ │                                     │  │
 *   │ │ │ ●Live  │ │ │                                     │  │
 *   │ │ └────────┘ │ │                                     │  │
 *   │ │  ─────     │ │                                     │  │
 *   │ │ Blueprint  │ │                                     │  │
 *   │ │   List     │ │                                     │  │
 *   │ │   Decisions│ │                                     │  │
 *   │ │   Risks    │ │                                     │  │
 *   │ │   Inventory│ │                                     │  │
 *   │ │  ─────     │ │                                     │  │
 *   │ │   AWS      │ │                                     │  │
 *   │ │   Updates  │ │                                     │  │
 *   │ │   Settings │ │                                     │  │
 *   │ │            │ │                                     │  │
 *   │ │  (filler)  │ │                                     │  │
 *   │ │            │ │                                     │  │
 *   │ │ ┌─Footer─┐ │ │                                     │  │
 *   │ │ │ U email│ │ │                                     │  │
 *   │ │ │  menu →│ │ │                                     │  │
 *   │ │ └────────┘ │ │                                     │  │
 *   │ └────────────┘ └─────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────────────────┘
 *
 * The user menu lives INSIDE the rail's footer (Discord/Slack/Linear
 * pattern), not floating. Account access is "in" the navigation,
 * always visible, no overlap with the canvas.
 */

import { useState, type ReactNode } from "react";
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
  views,
  counts,
  hasAws,
  awsNeedsAttention,
  userEmail,
  flashes,
  autoRefreshSlot,
}: {
  projectName: string;
  status: { kind: StatusKind; label: string };
  summary?: string | null;
  views: Record<ViewKey, ReactNode>;
  counts: Partial<Record<ViewKey, number>>;
  hasAws: boolean;
  awsNeedsAttention: boolean;
  userEmail: string;
  flashes: ReactNode;
  autoRefreshSlot: ReactNode;
}) {
  const [active, setActive] = useState<ViewKey>("blueprint");

  const blueprintItems: NavItem[] = [
    { key: "blueprint", label: "Blueprint" },
    { key: "list", label: "List" },
    { key: "decisions", label: "Decisions", count: counts.decisions ?? 0 },
    { key: "risks", label: "Risks", count: counts.risks ?? 0 },
    { key: "inventory", label: "Inventory" },
  ];
  const projectItems: NavItem[] = [
    ...(hasAws
      ? ([
          {
            key: "aws",
            label: "AWS connection",
            badge: awsNeedsAttention ? "warn" : undefined,
          } as NavItem,
        ])
      : []),
    { key: "updates", label: "Recent updates", count: counts.updates ?? 0 },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="ws">
      {autoRefreshSlot}

      <aside className="ws-rail">
        <RailHeader
          projectName={projectName}
          status={status}
          summary={summary}
        />

        {flashes && <div className="ws-rail-flashes">{flashes}</div>}

        <nav className="ws-rail-nav" aria-label="Project views">
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

        <RailFooter email={userEmail} />
      </aside>

      <main className="ws-main">
        {(Object.keys(views) as ViewKey[]).map((key) => (
          <div
            key={key}
            className="ws-view"
            hidden={active !== key}
            aria-hidden={active !== key}
          >
            {views[key]}
          </div>
        ))}
      </main>
    </div>
  );
}

// ===========================================================================
// Rail components
// ===========================================================================

function RailHeader({
  projectName,
  status,
  summary,
}: {
  projectName: string;
  status: { kind: StatusKind; label: string };
  summary?: string | null;
}) {
  return (
    <header className="ws-rail-head">
      <Link href="/dashboard" className="ws-rail-back">
        ← All projects
      </Link>
      <div className="ws-rail-title-row">
        <h1 className="ws-rail-title">{projectName}</h1>
        <StatusChip status={status} />
      </div>
      {summary && <p className="ws-rail-summary">{summary}</p>}
    </header>
  );
}

function StatusChip({
  status,
}: {
  status: { kind: StatusKind; label: string };
}) {
  return (
    <span
      className={`ws-status ws-status-${status.kind}`}
      aria-label={`Blueprint ${status.label}`}
    >
      <span className="ws-status-dot" aria-hidden />
      {status.label}
    </span>
  );
}

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
    <div className="ws-nav-section">
      <p className="ws-nav-section-label">{label}</p>
      <ul className="ws-nav-list">{children}</ul>
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
        className={`ws-nav-item ${active ? "ws-nav-item-active" : ""}`}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
      >
        <span className="ws-nav-label">{item.label}</span>
        {item.badge === "warn" && (
          <span
            className="ws-nav-badge ws-nav-badge-warn"
            aria-label="needs attention"
          />
        )}
        {item.count !== undefined && item.count > 0 && (
          <span className="ws-nav-count">{item.count}</span>
        )}
      </button>
    </li>
  );
}

// ===========================================================================
// Rail footer — account / user menu, anchored to bottom of rail
// ===========================================================================

function RailFooter({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const initials = monogram(email);
  return (
    <div className="ws-rail-foot">
      {open && (
        <>
          <div
            className="ws-user-scrim"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="ws-user-pop" role="menu">
            <ul className="ws-user-pop-list">
              <li>
                <button
                  type="button"
                  className="ws-user-pop-item ws-user-pop-disabled"
                  disabled
                >
                  <span>Account settings</span>
                  <span className="ws-user-pop-soon">soon</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="ws-user-pop-item ws-user-pop-disabled"
                  disabled
                >
                  <span>Billing</span>
                  <span className="ws-user-pop-soon">soon</span>
                </button>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="ws-user-pop-item"
                  onClick={() => setOpen(false)}
                >
                  All projects
                </Link>
              </li>
            </ul>
            <form
              action="/api/auth/signout"
              method="post"
              className="ws-user-pop-form"
            >
              <button type="submit" className="ws-user-pop-signout">
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
      <button
        type="button"
        className={`ws-user-trigger ${open ? "ws-user-trigger-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="ws-user-avatar" aria-hidden>
          {initials}
        </span>
        <span className="ws-user-meta">
          <span className="ws-user-email">{email || "Signed in"}</span>
          <span className="ws-user-role">Account</span>
        </span>
        <span className="ws-user-chev" aria-hidden>
          ⋯
        </span>
      </button>
    </div>
  );
}

function monogram(email: string): string {
  if (!email) return "?";
  const local = email.split("@")[0];
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return local.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
