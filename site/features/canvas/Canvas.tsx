"use client";

/**
 * Canvas — the React Flow surface that renders the dashboard's
 * Service graph at the current drill level.
 *
 * Step 1: pan/zoom, no interactions.
 * Step 2 (this step): node clicks + pane clicks drive the workspace
 *   store's `selection`. Selected nodes render a ring (handled inside
 *   CanvasNode reading `data.isSelected`).
 *
 * Selection rules (per the user instruction):
 *   - Click a node → setSelection({ kind: "service", id })
 *   - Click the same node again → deselect (back to { kind: "none" })
 *   - Click the canvas background (pane) → deselect
 *
 * The Canvas component itself is mode-agnostic. Future modes (data
 * flow, simulate) will read selection + drillStack from the store
 * and render different inspector content; the canvas surface stays
 * the same.
 */

import { useCallback, useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Project } from "@/lib/types";
import { useWorkspaceStore } from "@/store/workspace-store";
import CanvasNode from "./CanvasNode";
import { useCanvasNodes, type CanvasNodeData } from "./hooks/useCanvasNodes";

// Memoised so React Flow doesn't re-instantiate the node-type
// registry on every render. nodeTypes is a structural prop and a
// fresh object would force RF to remount every node.
const NODE_TYPES: NodeTypes = { service: CanvasNode };

export default function Canvas({ project }: { project: Project }) {
  const drillStack = useWorkspaceStore((s) => s.drillStack);
  const selection = useWorkspaceStore((s) => s.selection);
  const setSelection = useWorkspaceStore((s) => s.setSelection);

  const { nodes: laidOutNodes, edges } = useCanvasNodes(project, drillStack);

  // Augment the laid-out nodes with the current selection state.
  // Layout (dagre) is independent of selection, so we do this after
  // the layout pass — keeps the heavy work in useCanvasNodes from
  // re-running on every click.
  const nodes = useMemo<Node<CanvasNodeData>[]>(() => {
    const selectedId =
      selection.kind === "service" ? selection.id : null;
    return laidOutNodes.map((n) =>
      n.data.isSelected === (n.id === selectedId)
        ? n
        : { ...n, data: { ...n.data, isSelected: n.id === selectedId } }
    );
  }, [laidOutNodes, selection]);

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
        edges={edges}
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
