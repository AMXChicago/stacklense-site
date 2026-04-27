"use client";

/**
 * ActivitySidebar — the left rail of the dashboard workspace.
 *
 * Per spec layout / region specs / Activity sidebar:
 *   "~200px wide, full body height. Always visible (collapse
 *    later if needed). Each item: relative time, kind dot,
 *    summary text. Hover preview, click to commit."
 *
 * And the spec's anti-pattern callout, which dictated this region:
 *   "Putting the activity feed in the bottom panel as a co-equal
 *    with the inspector. It's the hero. Sidebar."
 *
 * Step 7 ships read-only:
 *   - Live indicator (visual-only pulsing dot — no real subscription
 *     yet; the introspection layer wires up in step 10).
 *   - Activity list, sorted desc by timestamp (the fixture is
 *     pre-sorted; we render whatever order the model provides).
 *   - Independent scroll inside the sidebar — list overflow does
 *     NOT push the canvas around.
 *   - Same content at every drill level. Drilling does not filter
 *     activities; the feed is project-wide and reflects everything
 *     the introspection layer reports, regardless of which subtree
 *     the user is currently looking at.
 *
 * Step 8 will add click handlers (activity → flash affected nodes
 * + swap inspector to "Architectural diff" mode).
 */

import type { Project } from "@/lib/types";
import ActivityItem from "./ActivityItem";

export default function ActivitySidebar({ project }: { project: Project }) {
  return (
    <aside
      // role=complementary so screen readers announce this as a
      // supporting region. The canvas is the primary content; the
      // activity feed annotates it.
      role="complementary"
      aria-label="Activity feed"
      className="flex h-full w-[200px] min-w-[200px] flex-col border-r border-border bg-bg"
    >
      <Header />
      <ol className="flex-1 min-h-0 divide-y divide-border overflow-y-auto">
        {project.activity.length === 0 ? (
          <li className="px-3 py-4 text-xs text-ink3">
            No activity yet.
          </li>
        ) : (
          project.activity.map((a) => <ActivityItem key={a.id} activity={a} />)
        )}
      </ol>
    </aside>
  );
}

/**
 * Sidebar header with the live indicator. The pulse animation
 * is purely visual for step 7 — no real WebSocket / polling
 * connection is wired. When step 10 lands the live data layer,
 * this dot can flip between "subscribed" / "reconnecting" /
 * "stale" states; the markup is already in place.
 */
function Header() {
  return (
    <div className="flex h-9 min-h-[36px] shrink-0 items-center gap-2 border-b border-border px-3 font-mono text-[11px] uppercase tracking-wider text-ink2">
      <span className="relative inline-flex h-2 w-2 items-center justify-center">
        {/* Outer pulse ring — same animation pattern used in the
            landing nav-logo-mark (globals.css `breathe`); reused
            here so the sidebar's "live" indicator matches the
            rest of the app's design language. The inner dot stays
            opaque; the outer ring expands and fades. */}
        <span
          aria-hidden
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ backgroundColor: "var(--green)" }}
        />
        <span
          aria-hidden
          className="relative inline-flex h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--green)" }}
        />
      </span>
      <span>Live</span>
      <span className="ml-auto text-ink3">Activity</span>
    </div>
  );
}
