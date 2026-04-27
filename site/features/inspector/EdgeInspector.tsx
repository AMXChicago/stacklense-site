"use client";

/**
 * Inspector for `selection.kind === "connection"` (step 6).
 * Composes the v4 split layout: STRIP on top, TABS + TAB BODY
 * below, exactly the same shape as NodeInspector. The strip and
 * tabs differ in content (from→to + Explain/Schema/Stats vs.
 * service-shaped + Explain/Metrics/Connections), but the layout
 * shell stays identical so the inspector "feels" the same when
 * switching between node and edge selections.
 *
 * Rolled-up edges
 * ───────────────
 *   The canvas's edge roll-up rules can collapse multiple
 *   underlying connections into a single rendered edge. When the
 *   user clicks a rendered edge, the workspace store selects the
 *   "primary" connection (first in insertion order). The strip
 *   surfaces a "+N more rolled up" badge so the user knows the
 *   inspector view shows ONE connection out of N. Clicking the
 *   underlying connections list (in the future) could let them
 *   cycle through.
 *
 *   For step 6, `rolledUpExtras` is computed in EdgeInspector by
 *   counting connections that share the (rolled-up-from,
 *   rolled-up-to, type) tuple at the current drill level. Cheap
 *   to compute and avoids stuffing more state into the store.
 */

import type { Connection, Project } from "@/lib/types";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  rollUpToVisible,
  visibleServiceIdsAt,
} from "@/features/canvas/hooks/useCanvasNodes";
import EdgeInspectorStrip from "./EdgeInspectorStrip";
import EdgeInspectorTabs from "./EdgeInspectorTabs";

export default function EdgeInspector({
  connection,
  project,
}: {
  connection: Connection;
  project: Project;
}) {
  const drillStack = useWorkspaceStore((s) => s.drillStack);
  const rolledUpExtras = countRolledUpSiblings(
    connection,
    project,
    drillStack
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EdgeInspectorStrip
        connection={connection}
        project={project}
        rolledUpExtras={rolledUpExtras}
      />
      <EdgeInspectorTabs connection={connection} project={project} />
    </div>
  );
}

/**
 * Count how many OTHER connections roll up to the same rendered
 * edge as the one currently selected, at the current drill level.
 * Returns 0 when this connection is the only one contributing to
 * its rendered edge.
 *
 * Mirrors the canvas's roll-up + dedupe key: `(fromV, toV, type)`.
 * Lives here (not in the store) because it depends on drill state
 * and project shape — both already in scope when the inspector
 * renders.
 */
function countRolledUpSiblings(
  connection: Connection,
  project: Project,
  drillStack: readonly string[]
): number {
  const visibleSet = new Set(visibleServiceIdsAt(project, drillStack));
  const myFromV = rollUpToVisible(
    connection.fromServiceId,
    project,
    visibleSet
  );
  const myToV = rollUpToVisible(connection.toServiceId, project, visibleSet);
  // Boundary edges (one side rolls up, the other doesn't) are
  // 1-to-1 with their underlying Connection — no roll-up siblings.
  if (!myFromV || !myToV || myFromV === myToV) return 0;
  let count = 0;
  for (const c of Object.values(project.connections)) {
    if (c.id === connection.id) continue;
    if (c.type !== connection.type) continue;
    const fromV = rollUpToVisible(c.fromServiceId, project, visibleSet);
    const toV = rollUpToVisible(c.toServiceId, project, visibleSet);
    if (fromV === myFromV && toV === myToV) count += 1;
  }
  return count;
}
