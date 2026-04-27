"use client";

/**
 * Canvas — the React Flow surface that renders the dashboard's
 * Service graph at the current drill level.
 *
 * Step 1: pan/zoom, no interactions.
 * Step 2: node clicks + pane clicks drive the workspace store's
 *   `selection`. Selected nodes render a ring (handled inside
 *   CanvasNode reading `data.isSelected`).
 * Step 3 (this step): platform filter chips set `filter` in the
 *   workspace store. Canvas reads it, computes the dimmed set via
 *   the shared dimming module (lib/dimming.ts), and layers
 *   `isDimmed` onto nodes + an opacity multiplier onto edges.
 *   Layout (dagre) is unaffected: only node `data.isDimmed` and
 *   edge `style.opacity` change when the filter changes.
 *
 * Selection rules (unchanged from step 2):
 *   - Click a node → setSelection({ kind: "service", id })
 *   - Click the same node again → deselect (back to { kind: "none" })
 *   - Click the canvas background (pane) → deselect
 *
 * Filter ↔ selection independence (per the step 3 spec):
 *   A node can stay selected while dimmed; clicking a dimmed node
 *   still works. We never disable pointer events on dimmed nodes.
 *
 * The Canvas component itself is mode-agnostic. Future modes (data
 * flow, simulate) will read selection + drillStack from the store
 * and render different inspector content; the canvas surface stays
 * the same. Trace mode (step 9) will reuse the same dimming
 * mechanism with a different "dimmed set" computation.
 */

import { useCallback, useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Project } from "@/lib/types";
import {
  DIMMED_OPACITY,
  dimmedByPlatformFilter,
  isEdgeDimmed,
} from "@/lib/dimming";
import { useWorkspaceStore } from "@/store/workspace-store";
import CanvasNode from "./CanvasNode";
import {
  useCanvasNodes,
  visibleServiceIdsAt,
  type CanvasNodeData,
} from "./hooks/useCanvasNodes";

// Memoised so React Flow doesn't re-instantiate the node-type
// registry on every render. nodeTypes is a structural prop and a
// fresh object would force RF to remount every node.
const NODE_TYPES: NodeTypes = { service: CanvasNode };

export default function Canvas({ project }: { project: Project }) {
  const drillStack = useWorkspaceStore((s) => s.drillStack);
  const selection = useWorkspaceStore((s) => s.selection);
  const setSelection = useWorkspaceStore((s) => s.setSelection);
  const filter = useWorkspaceStore((s) => s.filter);

  const { nodes: laidOutNodes, edges: laidOutEdges } = useCanvasNodes(
    project,
    drillStack
  );

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

  // Edge dimming inherits from node dimming — an edge with at least
  // one dimmed endpoint inherits the same opacity. The edge's
  // type-based style (solid / dashed / webhook colour) is preserved;
  // only `opacity` is overlaid. When the dimmed set is empty, return
  // the original edges array unchanged (cheap fast path for the
  // common "no filter" case).
  const styledEdges = useMemo<Edge[]>(() => {
    if (dimmedIds.size === 0) return laidOutEdges;
    return laidOutEdges.map((e) => {
      const dimmed = isEdgeDimmed(e.source, e.target, dimmedIds);
      const baseStyle = e.style ?? {};
      return {
        ...e,
        style: { ...baseStyle, opacity: dimmed ? DIMMED_OPACITY : 1 },
      };
    });
  }, [laidOutEdges, dimmedIds]);

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

  return (
    <div className="h-full w-full bg-bg3">
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
    </div>
  );
}
