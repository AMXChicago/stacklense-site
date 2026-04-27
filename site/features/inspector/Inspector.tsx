"use client";

/**
 * Inspector — top-level component for the bottom region of the
 * dashboard workspace. Per spec layout / region specs, the
 * inspector is "full-width, swaps content based on selection"
 * (node, edge, function, activity item, or current mode state).
 *
 * Selection routing:
 *   - `selection.kind === "service"`    → NodeInspector  (step 2)
 *   - `selection.kind === "connection"` → EdgeInspector  (step 6)
 *   - `selection.kind === "activity"`   → empty (step 8)
 *   - `selection.kind === "none"`       → InspectorEmpty (step 2)
 *
 * Mutual exclusivity: the workspace store's `selection` is a
 * tagged union, so by construction a node and an edge can't be
 * selected at the same time. Canvas.tsx enforces this on click
 * (selecting an edge clears any node selection and vice versa).
 *
 * Inspector minimum height (per spec, locked in step 2 ambiguity
 * resolutions): 280px. Lower bound exists because the strip + tabs
 * + first row of tab content need vertical room to breathe.
 */

import type { Project } from "@/lib/types";
import { useWorkspaceStore } from "@/store/workspace-store";
import EdgeInspector from "./EdgeInspector";
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
      ) : selection.kind === "connection" &&
        project.connections[selection.id] ? (
        <EdgeInspector
          connection={project.connections[selection.id]}
          project={project}
        />
      ) : (
        // Empty state covers selection.kind === "none" AND any
        // future kinds we haven't wired up yet (activity). When
        // its inspector renderer ships in step 8 it slots in
        // alongside the others above.
        <InspectorEmpty projectName={project.name} />
      )}
    </aside>
  );
}
