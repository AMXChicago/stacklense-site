/**
 * Compute React Flow nodes + edges for the dashboard canvas at any
 * drill level.
 *
 * Recursive from day one (per spec): the same logic renders the
 * top-level view (drillStack: []) and any nested view (e.g.
 * drillStack: ["aws"], drillStack: ["aws", "lambda"]). Step 1
 * displays only the top level because nothing pushes onto the
 * drillStack yet — drill-down interactions land in spec build
 * step 4.
 *
 * Visibility rule
 * ───────────────
 *   - drillStack empty  → visible nodes = project.rootServiceIds
 *   - drillStack non-empty → visible nodes = direct children of the
 *     last id on the drillStack
 *
 * Edge roll-up rule
 * ─────────────────
 *   For every Connection, walk each endpoint upward through
 *   parentId until we hit a Service that's currently visible. If
 *   both endpoints roll up to the SAME visible Service the edge
 *   collapses (would draw a self-loop) and is dropped. The
 *   surviving edges are deduped by (rolled-up-from, rolled-up-to)
 *   pairs so the canvas doesn't render multiple parallel edges
 *   between the same two boxes when many internal connections roll
 *   up to the same boundary.
 *
 *   Spec ambiguity flagged: the spec doesn't explicitly say how to
 *   render connections that cross the drill boundary. Roll-up is
 *   the obvious choice for a recursive renderer — surfaces the
 *   relationship at the visible level, hides internal-to-a-platform
 *   detail until you drill in. If the spec wants different
 *   behaviour we can revisit.
 *
 * Layout
 * ──────
 *   dagre top-to-bottom for predictable positions independent of
 *   node count. Step 1 has 4 visible nodes; future drills may have
 *   more. Hand-positioning per drill level isn't viable.
 */

import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import dagre from "dagre";
import type {
  Connection,
  ConnectionType,
  Project,
  Service,
} from "@/lib/types";
import { edgeStyleFor } from "../edge-style";

// ── Layout constants ───────────────────────────────────────────────
const NODE_W = 220;
const NODE_H = 80;
const NODESEP = 60;
const RANKSEP = 110;

// ── Platform palette ───────────────────────────────────────────────
//
// Spec: "Color encodes platform, not state. Each top-level Platform
// gets one ramp. Maximum 5 platform colors per visible canvas."
//
// For step 1 we hard-code a small palette by service id. When the
// adapter wires up in step 10 the brand colour will come from
// Service.metadata.brandColor — at that point this map becomes a
// fallback for ids without brand metadata.
const PLATFORM_COLOR_FALLBACK: Record<string, string> = {
  user: "#5a5a54", // gray — non-platform top-level entry
  aws: "#ff9900",
  stripe: "#635bff",
  anthropic: "#d97757",
};
const NEUTRAL = "#5a5a54";

// ── Node data shape passed to the React Flow custom node ───────────
export type CanvasNodeData = {
  service: Service;
  /** Brand colour of the top-level platform this service belongs to. */
  platformColor: string;
  /** Top-left orange dot if recently changed (default window: 7 days). */
  changedRecently: boolean;
  /** Signal to step 4 / 5: this node has children that drill-down can open. */
  hasChildren: boolean;
  /**
   * True when this node is the current selection in the workspace
   * store. Set by Canvas.tsx after the hook returns — the hook
   * itself defaults to false so the layout pass doesn't depend on
   * selection state and dagre runs only when project/drillStack
   * change. CanvasNode renders a selection ring when true.
   */
  isSelected: boolean;
};

// ── Pure helpers (exported for unit tests in later steps) ──────────

export function visibleServiceIdsAt(
  project: Project,
  drillStack: readonly string[]
): string[] {
  if (drillStack.length === 0) return [...project.rootServiceIds];
  const parentId = drillStack[drillStack.length - 1];
  return Object.values(project.services)
    .filter((s) => s.parentId === parentId)
    .map((s) => s.id);
}

/**
 * Walk upward through parentId until we hit an id in `visible`.
 * Returns null if we walk off the top without crossing one (the
 * service lives in a different subtree from anything visible —
 * shouldn't happen with a well-formed project, but we guard).
 */
export function rollUpToVisible(
  serviceId: string,
  project: Project,
  visible: ReadonlySet<string>
): string | null {
  let current: Service | undefined = project.services[serviceId];
  while (current) {
    if (visible.has(current.id)) return current.id;
    if (current.parentId === null) return null;
    current = project.services[current.parentId];
  }
  return null;
}

/**
 * Find the top-level platform ancestor for a service. Used to pick
 * the node's brand colour. If the service IS top-level (parentId
 * null), it is its own platform.
 */
export function platformAncestorFor(
  service: Service,
  project: Project
): Service {
  let current: Service = service;
  while (current.parentId !== null) {
    const next = project.services[current.parentId];
    if (!next) return current;
    current = next;
  }
  return current;
}

function platformColorFor(service: Service, project: Project): string {
  const platform = platformAncestorFor(service, project);
  const fromMetadata =
    typeof platform.metadata.brandColor === "string"
      ? platform.metadata.brandColor
      : null;
  return fromMetadata ?? PLATFORM_COLOR_FALLBACK[platform.id] ?? NEUTRAL;
}

function isWithinDays(iso: string | undefined, days: number): boolean {
  if (!iso) return false;
  const ms = Date.now() - new Date(iso).getTime();
  return ms >= 0 && ms < days * 86_400_000;
}

function hasChildren(service: Service, project: Project): boolean {
  for (const candidate of Object.values(project.services)) {
    if (candidate.parentId === service.id) return true;
  }
  return false;
}

// ── Main hook ──────────────────────────────────────────────────────

export type CanvasView = {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
};

export function useCanvasNodes(
  project: Project,
  drillStack: readonly string[]
): CanvasView {
  return useMemo(() => buildView(project, drillStack), [project, drillStack]);
}

function buildView(project: Project, drillStack: readonly string[]): CanvasView {
  const visibleIds = visibleServiceIdsAt(project, drillStack);
  const visibleSet = new Set(visibleIds);

  // 1. Build nodes (positions filled by dagre).
  const rawNodes: Node<CanvasNodeData>[] = visibleIds.map((id) => {
    const service = project.services[id];
    return {
      id,
      type: "service",
      position: { x: 0, y: 0 },
      data: {
        service,
        platformColor: platformColorFor(service, project),
        changedRecently: isWithinDays(service.lastChangedAt, 7),
        hasChildren: hasChildren(service, project),
        // Canvas.tsx overrides this per render based on the current
        // workspace-store selection. Default false here so nodes
        // produced by the hook are correct in isolation (e.g.,
        // tests, future export-as-image use cases).
        isSelected: false,
      },
    };
  });

  // 2. Roll up cross-boundary connections to visible ancestors.
  type Pair = { from: string; to: string; type: ConnectionType };
  const seen = new Map<string, Pair>();
  for (const conn of Object.values(project.connections)) {
    const fromV = rollUpToVisible(conn.fromServiceId, project, visibleSet);
    const toV = rollUpToVisible(conn.toServiceId, project, visibleSet);
    if (!fromV || !toV || fromV === toV) continue;
    const key = `${fromV}|${toV}|${conn.type}`;
    if (!seen.has(key)) {
      seen.set(key, { from: fromV, to: toV, type: conn.type });
    }
  }

  const rawEdges: Edge[] = Array.from(seen.values()).map((pair, i) => ({
    id: `edge-${i}-${pair.from}-${pair.to}-${pair.type}`,
    source: pair.from,
    target: pair.to,
    type: "smoothstep",
    animated: false,
    style: edgeStyleFor(pair.type),
  }));

  // 3. Dagre layout (top → bottom).
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: NODESEP,
    ranksep: RANKSEP,
    marginx: 24,
    marginy: 24,
  });
  for (const node of rawNodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }
  for (const edge of rawEdges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  const positionedNodes: Node<CanvasNodeData>[] = rawNodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
    };
  });

  return { nodes: positionedNodes, edges: rawEdges };
}

/* Re-export of the legacy stub type kept temporarily so any
 * downstream import that still references it doesn't break. The
 * older stub returned `CanvasNode[]`; nothing in the repo imports it
 * yet, but the hook file declared the type and we don't want to
 * silently delete a public symbol. */
export type CanvasNode = Node<CanvasNodeData>;
