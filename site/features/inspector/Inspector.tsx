"use client";

/**
 * Inspector — top-level component for the bottom region of the
 * dashboard workspace. Per spec layout / region specs, the
 * inspector is "full-width, swaps content based on selection"
 * (node, edge, function, activity item, or current mode state).
 *
 * Step 2 wires up two of those states:
 *   - `selection.kind === "service"` → NodeInspector (strip + tabs)
 *   - `selection.kind === "none"`    → InspectorEmpty (overview)
 *
 * Other selection kinds (connection, activity) and the
 * mode-specific inspector contents (data flow trace, simulate)
 * arrive in their respective spec build steps. This component is
 * the single switchboard that picks one renderer per selection.
 *
 * Inspector minimum height (per spec, locked in step 2 ambiguity
 * resolutions): 280px. Lower bound exists because the strip + tabs
 * + first row of tab content need vertical room to breathe. The
 * page composes this with the canvas above; this component itself
 * just fills its container.
 */

import type { Project } from "@/lib/types";
import { useWorkspaceStore } from "@/store/workspace-store";
import InspectorEmpty from "./InspectorEmpty";
import NodeInspector from "./NodeInspector";

export default function Inspector({ project }: { project: Project }) {
  const selection = useWorkspaceStore((s) => s.selection);

  return (
    <aside
      // role=complementary marks this as a supporting region for
      // assistive tech. The inspector's content describes whatever
      // the user has selected in the main canvas region.
      role="complementary"
      aria-label="Inspector"
      className="flex h-full min-h-0 flex-col border-t border-border bg-bg"
    >
      {selection.kind === "service" && project.services[selection.id] ? (
        <NodeInspector
          service={project.services[selection.id]}
          project={project}
        />
      ) : (
        // Empty state covers selection.kind === "none" AND any
        // future kinds we haven't wired up yet (connection,
        // activity). When their inspector renderers ship in steps
        // 6 and 7 they slot in alongside NodeInspector above.
        <InspectorEmpty projectName={project.name} />
      )}
    </aside>
  );
}
