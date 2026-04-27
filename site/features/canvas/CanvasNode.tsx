"use client";

/**
 * The custom React Flow node for every Service in the canvas.
 *
 * Visual conventions per spec:
 *   - Status dot (top-right): green / amber / red / gray for
 *     healthy / degraded / down / unknown. Step 1 ships with all
 *     services as "unknown" — dots will go live in step 11.
 *   - Change indicator (top-left): orange dot if `lastChangedAt`
 *     is within the last 7 days. Optional small relative-time
 *     label below the dot.
 *   - Platform colour: applied as the LEFT BORDER of the node body.
 *     Color encodes platform; state is on the overlay dots only.
 *     Never recolours the node body itself.
 *   - Boundary pills (step 6): "← from {Name}" above, "→ to {Name}"
 *     below. Surfaces edges that drop because one endpoint is
 *     outside the visible drill subtree. Click to select the
 *     underlying connection in the edge inspector.
 *
 * Step 1 had no interactions; step 2 added single-click selection,
 * step 4 added double-click drill, step 6 adds boundary-pill clicks.
 */

import { Handle, type NodeProps, Position } from "@xyflow/react";
import type { ConnectionType, ServiceStatus } from "@/lib/types";
import { DIMMED_OPACITY } from "@/lib/dimming";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoundaryEdge, CanvasNodeData } from "./hooks/useCanvasNodes";

// Spec colour values verbatim from "Visual conventions > Status dots".
const STATUS_COLOR: Record<ServiceStatus, string> = {
  healthy: "#1D9E75",
  degraded: "#EF9F27",
  down: "#E24B4A",
  unknown: "#5a5a54",
};

const CHANGE_INDICATOR_COLOR = "#EF9F27"; // orange dot per spec

export type CanvasNodeProps = NodeProps & { data: CanvasNodeData };

export default function CanvasNode({ data }: CanvasNodeProps) {
  const {
    service,
    platformColor,
    changedRecently,
    hasChildren,
    isSelected,
    isDimmed,
    boundaryIn,
    boundaryOut,
  } = data;
  const statusColor = STATUS_COLOR[service.status];

  return (
    <div
      className={`relative flex h-[80px] w-[220px] cursor-pointer flex-col justify-center rounded-lg border border-border2 bg-bg2 px-3 py-2 transition-[opacity,box-shadow] duration-200 ${
        isSelected ? "ring-2 ring-ink ring-offset-2 ring-offset-bg3" : ""
      }`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: platformColor,
        // Dim non-matching nodes per the shared dimming mechanism in
        // lib/dimming.ts. Opacity is the ONLY visual change — the
        // selection ring, status dot, and platform colour are still
        // applied so a dimmed-but-selected node remains identifiable
        // and clickable. Pointer events stay enabled so the user
        // can still click into a dimmed node (filtering is non-
        // destructive — it doesn't disable interactions).
        opacity: isDimmed ? DIMMED_OPACITY : 1,
      }}
    >
      {/* Boundary pills — incoming external edges (step 6).
          Rendered above the card with absolute positioning so the
          80×220px node body stays a fixed size for dagre layout.
          Clicking a pill selects the underlying connection. */}
      {boundaryIn.length > 0 && (
        <BoundaryPills
          edges={boundaryIn}
          direction="in"
          className="absolute -top-2 left-3 -translate-y-full"
        />
      )}
      {boundaryOut.length > 0 && (
        <BoundaryPills
          edges={boundaryOut}
          direction="out"
          className="absolute -bottom-2 left-3 translate-y-full"
        />
      )}
      {/* React Flow handles (target on top, source on bottom). Hidden
          visually so the node looks clean; React Flow still routes
          edges to/from them. */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "transparent",
          border: "none",
          width: 1,
          height: 1,
        }}
      />

      {/* Change indicator (top-left) */}
      {changedRecently && (
        <span
          aria-label="recently changed"
          className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: CHANGE_INDICATOR_COLOR }}
        />
      )}

      {/* Status dot (top-right) */}
      <span
        aria-label={`status ${service.status}`}
        className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: statusColor }}
      />

      <div className="truncate pr-3 text-sm font-medium text-ink">
        {service.name}
      </div>
      <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-ink3">
        {service.kind}
        {hasChildren ? " · contains" : ""}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "transparent",
          border: "none",
          width: 1,
          height: 1,
        }}
      />
    </div>
  );
}

/**
 * Boundary pill stack — renders the dropped cross-subtree edges
 * for one direction (incoming above the card, outgoing below).
 * Multiple boundary edges from the same anchor stack horizontally;
 * the layout wraps if there are too many for one row.
 *
 * The pill itself is a button so it gets keyboard focus + Enter
 * activation for free. Clicking dispatches a connection selection
 * via the workspace store.
 *
 * Webhook-typed boundary edges get the amber tint matching their
 * canvas-edge stroke, so users can scan and see "this dropped edge
 * is a webhook return path" without reading the label closely.
 */
function BoundaryPills({
  edges,
  direction,
  className,
}: {
  edges: BoundaryEdge[];
  direction: "in" | "out";
  className?: string;
}) {
  const setSelection = useWorkspaceStore((s) => s.setSelection);
  return (
    <div
      // The pill stack lives outside the 80×220px node body bounds
      // intentionally — dagre lays out the body, and the pills float
      // above/below. `pointer-events-auto` so clicks register even
      // when the parent has the dim opacity applied.
      className={`flex max-w-[260px] flex-wrap gap-1 pointer-events-auto ${className ?? ""}`}
    >
      {edges.map((e) => (
        <button
          key={`${direction}-${e.connectionId}`}
          type="button"
          onClick={(ev) => {
            // Stop propagation so the click doesn't also fire the
            // node's onClick (which would select the node and
            // overwrite our connection selection).
            ev.stopPropagation();
            setSelection({ kind: "connection", id: e.connectionId });
          }}
          aria-label={`${direction === "in" ? "Incoming from" : "Outgoing to"} ${e.externalServiceName} (${e.type})`}
          className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${pillToneFor(e.type)}`}
        >
          <span aria-hidden>{direction === "in" ? "←" : "→"}</span>
          <span className="truncate">
            {direction === "in" ? "from" : "to"} {e.externalServiceName}
          </span>
        </button>
      ))}
    </div>
  );
}

function pillToneFor(type: ConnectionType): string {
  if (type === "webhook") {
    // Same arbitrary rgba pattern used for webhook tone elsewhere
    // — Tailwind's `/40`/`/10` opacity modifiers don't compose with
    // CSS-variable colors, so we hardcode here.
    return "border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.1)] text-amber hover:border-amber";
  }
  return "border-border2 bg-bg2 text-ink2 hover:border-ink3 hover:text-ink";
}
