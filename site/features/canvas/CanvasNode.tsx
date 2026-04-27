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
 *
 * Step 1 has no interactions on the node beyond what React Flow
 * gives us natively (drag-disabled, pan/zoom on the canvas). Click
 * + double-click handlers land in step 2 (inspector) and step 4
 * (drill-down).
 */

import { Handle, type NodeProps, Position } from "@xyflow/react";
import type { ServiceStatus } from "@/lib/types";
import type { CanvasNodeData } from "./hooks/useCanvasNodes";

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
  const { service, platformColor, changedRecently, hasChildren, isSelected } =
    data;
  const statusColor = STATUS_COLOR[service.status];

  return (
    <div
      className={`relative flex h-[80px] w-[220px] cursor-pointer flex-col justify-center rounded-lg border border-border2 bg-bg2 px-3 py-2 transition-shadow ${
        isSelected ? "ring-2 ring-ink ring-offset-2 ring-offset-bg3" : ""
      }`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: platformColor,
      }}
    >
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
