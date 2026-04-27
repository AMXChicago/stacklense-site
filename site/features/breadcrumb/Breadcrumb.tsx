"use client";

/**
 * Breadcrumb — the multi-level path indicator that ships in the
 * top-bar region of the dashboard workspace.
 *
 * Per spec layout / region specs / Top bar:
 *   "Left: project name + multi-level breadcrumb (`Project › AWS ›
 *    Lambda`) + live pulse indicator."
 *
 * The full top bar (with live indicator + mode switcher) lands in
 * its own step. Step 4 ships the breadcrumb portion only — the
 * minimum needed to make drill-down navigable.
 *
 * Per spec interactions / drill-down (recursive):
 *   "Breadcrumb segments are clickable to climb out."
 *
 * Click rules:
 *   - Project segment (always present) → drillTo(0) (≡ resetDrill)
 *   - Each drill segment → drillTo(index)
 *   - Last segment is the current scope — non-clickable styling
 *
 * URL purity (spec anti-pattern: "Using a separate route per drill
 * level"): clicking a segment ONLY mutates the workspace store's
 * drillStack. The URL is unchanged. There is no Next.js routing
 * involved at any drill level.
 */

import type { Project } from "@/lib/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function Breadcrumb({ project }: { project: Project }) {
  const drillStack = useWorkspaceStore((s) => s.drillStack);
  const drillTo = useWorkspaceStore((s) => s.drillTo);

  // Resolve each drill-stack id to its service for display. If a
  // stack id ever fails to resolve (shouldn't happen with a well-
  // formed project, but we guard) fall back to the raw id so the
  // breadcrumb still renders something.
  const segments = drillStack.map((id) => ({
    id,
    name: project.services[id]?.name ?? id,
  }));

  return (
    <nav
      // role=navigation + aria-label so assistive tech announces
      // this as a breadcrumb. We use a real <nav> element with an
      // ordered <ol> per the WAI breadcrumb pattern.
      aria-label="Breadcrumb"
      className="flex h-9 min-h-[36px] shrink-0 items-center border-b border-border bg-bg px-3 font-mono text-[11px] uppercase tracking-wider"
    >
      <ol className="flex items-center gap-1.5 text-ink2">
        {/* Project root segment — always present. */}
        <li
          {...(segments.length === 0 ? { "aria-current": "page" as const } : {})}
        >
          <SegmentContent
            label={project.name}
            isCurrent={segments.length === 0}
            onClick={() => drillTo(0)}
          />
        </li>
        {segments.map((seg, i) => {
          const depth = i + 1; // drillTo(depth) keeps i+1 entries
          const isCurrent = i === segments.length - 1;
          return (
            // The separator is rendered as a sibling <li role="presentation">
            // so we keep the WAI breadcrumb pattern (every visible item
            // is an <li> inside the <ol>) without nesting <li> elements.
            // Aria-hidden on the separator lets screen readers skip it.
            <li
              key={`${seg.id}-${i}`}
              {...(isCurrent ? { "aria-current": "page" as const } : {})}
              className="flex items-center gap-1.5"
            >
              <span aria-hidden="true" className="text-ink3">
                ›
              </span>
              <SegmentContent
                label={seg.name}
                isCurrent={isCurrent}
                onClick={() => drillTo(depth)}
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The interactive content of one breadcrumb segment. Returns a
 * button (clickable — there is no URL to navigate to per the spec
 * anti-pattern, so this is NOT an <a>) when not current, and plain
 * text when current. The wrapping <li> lives in the parent so
 * we don't end up with nested <li> elements (invalid HTML).
 */
function SegmentContent({
  label,
  isCurrent,
  onClick,
}: {
  label: string;
  isCurrent: boolean;
  onClick: () => void;
}) {
  if (isCurrent) {
    return <span className="text-ink">{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-ink2 transition-colors hover:text-ink"
    >
      {label}
    </button>
  );
}
