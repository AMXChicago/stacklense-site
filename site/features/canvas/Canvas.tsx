"use client";

/**
 * Canvas — the React Flow surface that renders the dashboard's
 * Service graph at the current drill level.
 *
 * Step 1: pan/zoom, no interactions.
 * Step 2: node clicks + pane clicks drive the workspace store's
 *   `selection`. Selected nodes render a ring (handled inside
 *   CanvasNode reading `data.isSelected`).
 * Step 3: platform filter chips set `filter` in the workspace
 *   store. Canvas reads it, computes the dimmed set via the shared
 *   dimming module (lib/dimming.ts), and layers `isDimmed` onto
 *   nodes + an opacity multiplier onto edges.
 * Step 4 (this step): double-click drills into a Service that has
 *   children. The drillStack lives in the workspace store as
 *   string[] (recursive-ready for step 5). Esc and the on-canvas
 *   Back button both pop one level; breadcrumb segments climb to
 *   any depth via `drillTo`. The same `useCanvasNodes` hook with
 *   the same edge roll-up rules renders every level — no separate
 *   route or screen per the spec anti-pattern.
 *
 * Selection ↔ drill rule (per step 4 user instruction):
 *   "Selection survives drill changes if the selected node is
 *    still visible at the new level; otherwise selection clears."
 *   Implemented as a useEffect that watches the visible set and
 *   clears selection if it's no longer in scope.
 *
 * Filter ↔ drill rule (per step 4 user instruction):
 *   "A filter active at the project level remains active when you
 *    drill in." Filter state is project-global; we do not touch it
 *    on drill changes. See PR body for the documented edge case
 *    where a persisted filter dims everything at a deeper level.
 *
 * Filter ↔ selection independence (unchanged from step 3):
 *   A node can stay selected while dimmed; clicking a dimmed node
 *   still works. We never disable pointer events on dimmed nodes.
 *
 * The Canvas component itself is mode-agnostic. Future modes (data
 * flow, simulate) will read selection + drillStack from the store
 * and render different inspector content; the canvas surface stays
 * the same. Trace mode (step 9) will reuse the same dimming
 * mechanism with a different "dimmed set" computation.
 */

import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Project, Service } from "@/lib/types";
import {
  DIMMED_OPACITY,
  dimmedByPlatformFilter,
  isEdgeDimmed,
} from "@/lib/dimming";
import { useWorkspaceStore } from "@/store/workspace-store";
import CanvasNode from "./CanvasNode";
import {
  rollUpToVisible,
  useCanvasNodes,
  visibleServiceIdsAt,
  type CanvasNodeData,
} from "./hooks/useCanvasNodes";

/**
 * Stroke style overlay for the SELECTED edge. Spec: "Edges become
 * first-class clickable objects. On click, edge gets a selection
 * style (info color, 2px stroke); inspector switches to edge mode."
 *
 * Selection styling is applied as an overlay on top of the edge's
 * type-based base style — same overlay pattern used for dimming
 * (lib/dimming.ts) so we don't end up with a custom edge component
 * just for selection.
 *
 * TODO (palette cleanup pass): the spec calls for "info color" but
 * our design tokens lack a dedicated `--info` hue. Using --green
 * here because it reads as "the active thing" in this palette.
 * When --info is added in a future cleanup pass, swap this constant
 * to `var(--info)` — single line change.
 */
const SELECTED_EDGE_COLOR = "var(--green)";
const SELECTED_EDGE_WIDTH = 2;

/**
 * TODO (boundary-pill density, deferred from step 6 review): when
 * a single visible node accumulates more than ~5 boundary edges in
 * one direction, collapse the overflow into a "+N more" pill that
 * expands on hover or click. The current fixture's busiest node
 * (createOrder at Lambda interior) has 2 boundary outs, well under
 * the threshold. Revisit when real introspection data lands and
 * we see hubs with many external dependencies.
 */

/**
 * "Drillable" predicate — the spec says: "Double-click a Service
 * that contains other Services → enter that Service's interior."
 *
 * Step 4 limited this to `kind: "platform"` services with children.
 * Step 5 broadens it: ANY service with children is drillable. This
 * was the spec's literal wording all along; step 4 was deliberately
 * narrower to keep one-level-of-drill the only behaviour exercised.
 *
 * Concrete consequences with the current fixture:
 *   - User actor (kind:"service", no children)        → not drillable
 *   - AWS (kind:"platform", has children)              → drillable
 *   - Lambda (kind:"service", has 6 function children) → drillable
 *   - RDS Postgres (kind:"service", no children)       → not drillable
 *   - createUser etc. (kind:"function", no children)   → not drillable
 *
 * The function-leaf case (functions never have children in this
 * fixture) means double-clicking a function is a no-op. If a
 * future step adds line-level drill we just keep adding children
 * to the model — this predicate already handles it.
 */
function isDrillable(service: Service, project: Project): boolean {
  for (const candidate of Object.values(project.services)) {
    if (candidate.parentId === service.id) return true;
  }
  return false;
}

// Memoised so React Flow doesn't re-instantiate the node-type
// registry on every render. nodeTypes is a structural prop and a
// fresh object would force RF to remount every node.
const NODE_TYPES: NodeTypes = { service: CanvasNode };

export default function Canvas({ project }: { project: Project }) {
  const drillStack = useWorkspaceStore((s) => s.drillStack);
  const selection = useWorkspaceStore((s) => s.selection);
  const setSelection = useWorkspaceStore((s) => s.setSelection);
  const filter = useWorkspaceStore((s) => s.filter);
  const pushDrill = useWorkspaceStore((s) => s.pushDrill);
  const popDrill = useWorkspaceStore((s) => s.popDrill);

  const { nodes: laidOutNodes, edges: laidOutEdges } = useCanvasNodes(
    project,
    drillStack
  );

  // Visible-set memo — used by both the dimming computation below
  // and the selection-survival effect. Cheap to compute (small
  // arrays); the memo just keeps the reference stable so effects
  // don't fire on identical drillStacks.
  const visibleSet = useMemo(
    () => new Set(visibleServiceIdsAt(project, drillStack)),
    [project, drillStack]
  );

  // Selection ↔ drill rule (unified — step 6 merge feedback):
  //   "Selection persists across drill changes if the selected
  //    entity remains visible. A node is visible if it is in the
  //    current subtree. An edge is visible if both endpoints (or
  //    one endpoint plus its boundary indicator) are rendered."
  //
  // Implementation: one visibility check, dispatched by selection.kind.
  //   - kind:"service"     → visibleSet.has(id)
  //   - kind:"connection"  → at least one endpoint rolls up to a
  //                          visible node (i.e. it renders as either
  //                          a full edge or a boundary pill).
  //   - kind:"none"        → nothing to clear.
  //
  // Effect (not a derived value) because clearing is a state
  // mutation; running it during render would be a React anti-pattern.
  useEffect(() => {
    if (selection.kind === "none") return;
    let stillVisible: boolean;
    if (selection.kind === "service") {
      stillVisible = visibleSet.has(selection.id);
    } else {
      // Connection visibility: at least one endpoint rolls up to
      // a visible node (either side of the edge is rendered as a
      // node OR as a boundary pill). If neither rolls up, the
      // connection has no on-canvas representation at this drill
      // level → clear selection.
      const conn = project.connections[selection.id];
      if (!conn) {
        stillVisible = false;
      } else {
        const fromV = rollUpToVisible(
          conn.fromServiceId,
          project,
          visibleSet
        );
        const toV = rollUpToVisible(conn.toServiceId, project, visibleSet);
        stillVisible = !!(fromV || toV);
      }
    }
    if (!stillVisible) {
      setSelection({ kind: "none" });
    }
  }, [selection, visibleSet, project, setSelection]);

  // Esc climbs one drill level (per spec). Window-level listener
  // because the React Flow canvas can swallow keyboard events when
  // it doesn't have focus. No-op when already at root.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (drillStack.length === 0) return;
      // Don't intercept Esc while typing in any input/textarea/
      // contenteditable. Future search affordance + inspector edit
      // fields shouldn't be blocked by this handler.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      popDrill();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drillStack, popDrill]);

  // Compute the set of dimmed node IDs for the current filter at
  // the current drill level. Source of truth lives in lib/dimming.ts
  // — same module will feed step 4 (drill-down dim) and step 9
  // (trace dim) so the visual treatment is consistent.
  const dimmedIds = useMemo(
    () =>
      dimmedByPlatformFilter(
        visibleServiceIdsAt(project, drillStack),
        filter,
        project
      ),
    [project, drillStack, filter]
  );

  // Augment the laid-out nodes with both selection state and the
  // dimmed flag. Layout (dagre) is independent of both, so we do
  // this after the layout pass — keeps the heavy work in
  // useCanvasNodes from re-running on every click or chip toggle.
  // Only re-allocate node objects whose flags actually changed —
  // React Flow does its own equality check on `data` and avoids
  // remounting nodes when the data reference is stable.
  const nodes = useMemo<Node<CanvasNodeData>[]>(() => {
    const selectedId =
      selection.kind === "service" ? selection.id : null;
    return laidOutNodes.map((n) => {
      const nextSelected = n.id === selectedId;
      const nextDimmed = dimmedIds.has(n.id);
      if (
        n.data.isSelected === nextSelected &&
        n.data.isDimmed === nextDimmed
      ) {
        return n;
      }
      return {
        ...n,
        data: { ...n.data, isSelected: nextSelected, isDimmed: nextDimmed },
      };
    });
  }, [laidOutNodes, selection, dimmedIds]);

  // Edge styling overlay: combines DIMMING (one or both endpoints
  // dimmed → 16% opacity) and SELECTION (current connection
  // selection matches one of this edge's underlying connection ids
  // → 2px green stroke). Both are applied via `style` overlay so
  // we don't need a custom edge component.
  //
  // Selection match: the rendered edge stores `data.connectionIds`
  // (array of underlying connection ids that rolled up into this
  // edge). If the selected connection is in that array, the edge
  // is "selected" visually.
  const styledEdges = useMemo<Edge[]>(() => {
    const selectedConnectionId =
      selection.kind === "connection" ? selection.id : null;
    if (dimmedIds.size === 0 && !selectedConnectionId) return laidOutEdges;
    return laidOutEdges.map((e) => {
      const dimmed = isEdgeDimmed(e.source, e.target, dimmedIds);
      const ids = (e.data as { connectionIds?: string[] } | undefined)
        ?.connectionIds;
      const isSelected =
        !!selectedConnectionId && !!ids?.includes(selectedConnectionId);
      const baseStyle = e.style ?? {};
      const nextStyle: React.CSSProperties = { ...baseStyle };
      if (dimmedIds.size > 0) {
        nextStyle.opacity = dimmed ? DIMMED_OPACITY : 1;
      }
      if (isSelected) {
        nextStyle.stroke = SELECTED_EDGE_COLOR;
        nextStyle.strokeWidth = SELECTED_EDGE_WIDTH;
      }
      return { ...e, style: nextStyle };
    });
  }, [laidOutEdges, dimmedIds, selection]);

  const fitViewOptions = useMemo(
    () => ({ padding: 0.18, minZoom: 0.5, maxZoom: 1.4 }),
    []
  );

  // Click a node → select it. Click the SAME node → deselect.
  // The cast on data is necessary because React Flow's NodeMouseHandler
  // generic doesn't carry our custom NodeData type — it gives us
  // Node<Record<string, unknown>>. We know the canvas only renders
  // CanvasNode nodes (service kind), so casting through unknown is
  // safe and explicit.
  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      const isAlreadySelected =
        selection.kind === "service" && selection.id === node.id;
      if (isAlreadySelected) {
        setSelection({ kind: "none" });
      } else {
        setSelection({ kind: "service", id: node.id });
      }
    },
    [selection, setSelection]
  );

  // Click the empty pane → deselect.
  const onPaneClick = useCallback(() => {
    if (selection.kind !== "none") {
      setSelection({ kind: "none" });
    }
  }, [selection, setSelection]);

  // Click an edge → select the underlying connection. Mutual
  // exclusivity with node selection is automatic: setSelection
  // fully replaces the workspace store's `selection` slot, so a
  // prior {kind:"service"} value is cleared.
  //
  // Click-toggle behaviour mirrors node selection: clicking the
  // SAME edge again deselects.
  //
  // Rolled-up edges select their PRIMARY connection (first
  // contributor). Step 6's edge inspector surfaces "+N more rolled
  // up" so the user knows there are siblings.
  const onEdgeClick = useCallback<EdgeMouseHandler>(
    (_event, edge) => {
      const data = edge.data as
        | { primaryConnectionId?: string }
        | undefined;
      const primaryId = data?.primaryConnectionId;
      if (!primaryId) return;
      const alreadySelected =
        selection.kind === "connection" && selection.id === primaryId;
      if (alreadySelected) {
        setSelection({ kind: "none" });
      } else {
        setSelection({ kind: "connection", id: primaryId });
      }
    },
    [selection, setSelection]
  );

  // Double-click drills into a Service that has children. Non-
  // drillable nodes (kind: "service" leaves like User actor; future
  // function-kind nodes) are no-ops on double-click. Single-click
  // selection above is unaffected because RF fires onNodeClick
  // independently for both ticks of the double-click.
  const onNodeDoubleClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      const svc = project.services[node.id];
      if (!svc) return;
      if (!isDrillable(svc, project)) return;
      pushDrill(node.id);
    },
    [project, pushDrill]
  );

  const isDrilledIn = drillStack.length > 0;

  return (
    <div className="relative h-full w-full bg-bg3">
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={fitViewOptions}
        // Step 2: clicks on nodes/pane drive selection. RF's own
        // selection state is disabled (elementsSelectable=false) so
        // clicks don't toggle a parallel "RF selected" highlight —
        // our store is the single source of truth.
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDoubleClick={onNodeDoubleClick}
        // Step 6: edges become clickable.
        onEdgeClick={onEdgeClick}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.4}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={28} size={1} color="rgba(255,255,255,0.05)" />
        <Controls
          showInteractive={false}
          className="!bg-bg2 !border !border-border2 !shadow-none"
        />
      </ReactFlow>

      {/* Back button per spec: "Back button in canvas corner climbs
          one level." Visible only when drilled in. Top-left so it's
          out of the way of the bottom-left React Flow Controls.
          Positioned over the canvas via absolute positioning on the
          relative wrapper above. */}
      {isDrilledIn && (
        <button
          type="button"
          onClick={() => popDrill()}
          aria-label="Back to parent level"
          className="absolute left-3 top-3 z-10 flex h-8 items-center gap-2 rounded-md border border-border2 bg-bg2 px-3 font-mono text-[11px] uppercase tracking-wider text-ink2 transition-colors hover:text-ink"
        >
          <span aria-hidden="true">←</span> Back
        </button>
      )}
    </div>
  );
}
