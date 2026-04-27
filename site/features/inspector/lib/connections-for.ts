/**
 * Compute the in/out connection lists for a selected service, using
 * the SAME edge roll-up rule the canvas uses. Per spec (locked in
 * step 2 ambiguity resolutions): the Connections tab shows the set
 * of edges touching the selected node at the current drill level —
 * which means rolled-up to nearest visible ancestor, not the literal
 * underlying connections.
 *
 * Why roll-up matters: the user clicked the AWS box on the canvas;
 * what they expect to see in "Connections" is what they see touching
 * AWS in the canvas (User → AWS, AWS → Stripe, etc.) — not the empty
 * list that AWS-itself-as-an-id would produce, since the actual
 * connections live on Lambda inside AWS.
 *
 * For non-platform services the rolled-up set is identical to the
 * literal set, so this helper is correct in the leaf case too.
 */

import type { Connection, Project } from "@/lib/types";
import {
  rollUpToVisible,
  visibleServiceIdsAt,
} from "@/features/canvas/hooks/useCanvasNodes";

export type ConnectionView = {
  /** Stable id (the underlying Connection.id) for React keys. */
  id: string;
  /** Direction relative to the selected service. */
  direction: "out" | "in";
  /** The other service's id at the current drill level (rolled-up). */
  otherServiceId: string;
  /** The other service's display name. */
  otherServiceName: string;
  type: Connection["type"];
  what: string;
};

export function connectionsForSelected(
  project: Project,
  selectedId: string,
  drillStack: readonly string[]
): { outgoing: ConnectionView[]; incoming: ConnectionView[] } {
  const visibleIds = new Set(visibleServiceIdsAt(project, drillStack));
  // The selected service might itself be off the visible level if
  // the caller is mid-drill. We still compute relative to the
  // CANVAS-VISIBLE form of `selectedId` so the answer matches what
  // the user can see.
  const selectedVisible = rollUpToVisible(selectedId, project, visibleIds);
  if (!selectedVisible) {
    return { outgoing: [], incoming: [] };
  }

  // Dedupe outgoing/incoming separately — rolling up many internal
  // connections may produce duplicates (e.g., Lambda → Stripe and
  // Lambda → Stripe via different fixtures both collapse to AWS →
  // Stripe). Key by (other, type) since the canvas dedupes the same
  // way.
  const outgoing = new Map<string, ConnectionView>();
  const incoming = new Map<string, ConnectionView>();

  for (const conn of Object.values(project.connections)) {
    const fromV = rollUpToVisible(conn.fromServiceId, project, visibleIds);
    const toV = rollUpToVisible(conn.toServiceId, project, visibleIds);
    if (!fromV || !toV || fromV === toV) continue;

    if (fromV === selectedVisible) {
      const key = `${toV}|${conn.type}`;
      if (!outgoing.has(key)) {
        outgoing.set(key, {
          id: conn.id,
          direction: "out",
          otherServiceId: toV,
          otherServiceName: project.services[toV]?.name ?? toV,
          type: conn.type,
          what: conn.what,
        });
      }
    } else if (toV === selectedVisible) {
      const key = `${fromV}|${conn.type}`;
      if (!incoming.has(key)) {
        incoming.set(key, {
          id: conn.id,
          direction: "in",
          otherServiceId: fromV,
          otherServiceName: project.services[fromV]?.name ?? fromV,
          type: conn.type,
          what: conn.what,
        });
      }
    }
  }

  return {
    outgoing: Array.from(outgoing.values()),
    incoming: Array.from(incoming.values()),
  };
}
