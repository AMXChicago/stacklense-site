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
  /**
   * True when this node is visually dimmed (~16% opacity). Driven
   * by the shared dimming mechanism in lib/dimming.ts — used by
   * step 3 (platform filter), step 4 (drill-down), and step 9
   * (trace). Like `isSelected`, Canvas.tsx layers this on AFTER
   * the layout pass so filter / trace changes never cause dagre
   * to re-run.
   */
  isDimmed: boolean;
  /**
   * Boundary edges where this visible node is the *destination*
   * (incoming) and the source is outside the current visible
   * subtree. Step 6 renders these as small "← from {Name}" pills
   * above the node card; clicking one selects the underlying
   * connection in the inspector.
   *
   * Spec: "Edges with one endpoint outside the visible subtree
   * drop from the canvas. Boundary indicators show the dropped
   * external connections" (Interactions / Drill-down).
   */
  boundaryIn: BoundaryEdge[];
  /**
   * Boundary edges where this visible node is the *source*
   * (outgoing) and the destination is outside the current visible
   * subtree. Rendered as "→ to {Name}" pills below the node card.
   */
  boundaryOut: BoundaryEdge[];
};

/**
 * One dropped cross-subtree edge surfaced to the canvas as a
 * boundary indicator. Carries enough info for the pill to render
 * its label and to dispatch a connection selection on click.
 */
export type BoundaryEdge = {
  /** ID of the underlying Connection in `project.connections`. */
  connectionId: string;
  /** Which side of this edge is the EXTERNAL one. */
  externalSide: "from" | "to";
  /** Service ID of the external (non-visible) endpoint. */
  externalServiceId: string;
  /** Display name of the external endpoint. */
  externalServiceName: string;
  /** Connection type, drives pill colour for webhook-vs-rest. */
  type: ConnectionType;
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

  // Boundary edges per visible node — built up in the same pass as
  // the rolled-up edges below.
  const boundaryByNode = new Map<
    string,
    { in: BoundaryEdge[]; out: BoundaryEdge[] }
  >();
  for (const id of visibleIds) {
    boundaryByNode.set(id, { in: [], out: [] });
  }

  // 1. Roll up cross-boundary connections to visible ancestors.
  //
  //    Three outcomes per Connection:
  //      a) BOTH endpoints roll up to visible nodes (different
  //         services): contributes to a deduped rendered edge.
  //      b) ONE endpoint rolls up to visible, the other doesn't:
  //         becomes a BOUNDARY indicator anchored on the visible
  //         side, pointing at the external service.
  //      c) Neither endpoint rolls up: dropped silently (no anchor
  //         to attach a boundary pill to).
  //      d) Both roll up to the SAME visible node (self-loop after
  //         roll-up): dropped, same as before step 6.
  type Pair = {
    from: string;
    to: string;
    type: ConnectionType;
    /** First underlying connection that contributed to this edge —
     *  used as the selection target when the user clicks it. */
    primaryConnectionId: string;
    /** Total connections rolled up into this rendered edge. */
    rolledUpCount: number;
    /** All underlying connection IDs (in insertion order). The
     *  edge inspector can surface "+N more rolled-up" when this
     *  is greater than 1. */
    connectionIds: string[];
  };
  const seen = new Map<string, Pair>();
  for (const conn of Object.values(project.connections)) {
    const fromV = rollUpToVisible(conn.fromServiceId, project, visibleSet);
    const toV = rollUpToVisible(conn.toServiceId, project, visibleSet);

    // Case (a): both visible, distinct → rendered edge.
    if (fromV && toV && fromV !== toV) {
      const key = `${fromV}|${toV}|${conn.type}`;
      const existing = seen.get(key);
      if (existing) {
        existing.rolledUpCount += 1;
        existing.connectionIds.push(conn.id);
      } else {
        seen.set(key, {
          from: fromV,
          to: toV,
          type: conn.type,
          primaryConnectionId: conn.id,
          rolledUpCount: 1,
          connectionIds: [conn.id],
        });
      }
      continue;
    }

    // Case (b): exactly one side visible → boundary indicator.
    if (fromV && !toV) {
      // Visible node is the source, external is the destination.
      const externalId = conn.toServiceId;
      const externalName = project.services[externalId]?.name ?? externalId;
      boundaryByNode.get(fromV)?.out.push({
        connectionId: conn.id,
        externalSide: "to",
        externalServiceId: externalId,
        externalServiceName: externalName,
        type: conn.type,
      });
      continue;
    }
    if (toV && !fromV) {
      // Visible node is the destination, external is the source.
      const externalId = conn.fromServiceId;
      const externalName = project.services[externalId]?.name ?? externalId;
      boundaryByNode.get(toV)?.in.push({
        connectionId: conn.id,
        externalSide: "from",
        externalServiceId: externalId,
        externalServiceName: externalName,
        type: conn.type,
      });
      continue;
    }

    // Case (c) or (d): silently dropped, no boundary anchor.
  }

  // 2. Build nodes (positions filled by dagre). Done after boundary
  //    walk so each node can carry its boundary-edge lists in data.
  const rawNodes: Node<CanvasNodeData>[] = visibleIds.map((id) => {
    const service = project.services[id];
    const boundary = boundaryByNode.get(id) ?? { in: [], out: [] };
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
        // Same pattern as isSelected: defaults to false here, the
        // canvas overlays the real dimmed flag after computing the
        // dimmed set from the active filter (and, in later steps,
        // drill-down / trace state).
        isDimmed: false,
        boundaryIn: boundary.in,
        boundaryOut: boundary.out,
      },
    };
  });

  // Edges encode the primary connection ID and rolled-up metadata
  // in `data` so the canvas's onEdgeClick can dispatch the right
  // selection without re-resolving from the project.
  const rawEdges: Edge[] = Array.from(seen.values()).map((pair, i) => ({
    id: `edge-${i}-${pair.from}-${pair.to}-${pair.type}`,
    source: pair.from,
    target: pair.to,
    type: "smoothstep",
    animated: false,
    style: edgeStyleFor(pair.type),
    data: {
      type: pair.type,
      primaryConnectionId: pair.primaryConnectionId,
      rolledUpCount: pair.rolledUpCount,
      connectionIds: pair.connectionIds,
      // Canvas.tsx overlays these after the layout pass, same
      // pattern as nodes — keeps dagre out of the selection /
      // filter re-render path.
      isSelected: false,
      isDimmed: false,
    },
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
