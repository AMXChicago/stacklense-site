"use client";

/**
 * Canvas — the React Flow surface that renders the dashboard's
 * Service graph at the current drill level.
 *
 * Step 1 scope:
 *   - Renders nodes + edges produced by useCanvasNodes() against a
 *     hardcoded fixture Project. Top-level only (drillStack: []).
 *   - Pan + zoom. No other interactions.
 *   - No inspector, no filtering, no modes, no activity feed.
 *
 * The Canvas component itself is mode-agnostic and drill-level-
 * agnostic. Future steps wire in interactions by reading from /
 * dispatching to the workspace store; the surface stays the same.
 */

import { useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Project } from "@/lib/types";
import { useWorkspaceStore } from "@/store/workspace-store";
import CanvasNode from "./CanvasNode";
import { useCanvasNodes } from "./hooks/useCanvasNodes";

// Memoised so React Flow doesn't re-instantiate the node-type
// registry on every render. nodeTypes is a structural prop and a
// fresh object would force RF to remount every node.
const NODE_TYPES: NodeTypes = { service: CanvasNode };

export default function Canvas({ project }: { project: Project }) {
  const drillStack = useWorkspaceStore((s) => s.drillStack);
  const { nodes, edges } = useCanvasNodes(project, drillStack);

  // useMemo for the fitViewOptions object so the prop reference is
  // stable across renders. RF treats prop identity as a layout
  // signal.
  const fitViewOptions = useMemo(
    () => ({ padding: 0.18, minZoom: 0.5, maxZoom: 1.4 }),
    []
  );

  return (
    <div className="h-full w-full bg-bg3">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={fitViewOptions}
        // Step 1: pan + zoom only. No node drag, no edge selection,
        // no connection drawing.
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
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
