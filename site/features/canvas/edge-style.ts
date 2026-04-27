/**
 * Edge styling per spec "Visual conventions > Edge styles".
 *
 *   - Solid line:     synchronous (HTTP, RPC, function call)
 *   - Dashed line:    asynchronous (queued, fire-and-forget, fan-out)
 *   - Different color: webhook (return path)
 *   - Event:          treated as async (fine-dashed) until the spec
 *                     calls out a distinct visual.
 *
 * The dashboard NEVER uses colour to encode service state — that's
 * the role of the status dot overlay on each node. Edge colour is
 * used only to distinguish webhook return paths, which are
 * structurally different from the rest of the graph (they flow
 * inbound from an external service).
 */

import type { CSSProperties } from "react";
import type { ConnectionType } from "@/lib/types";

const SYNC_STROKE = "rgba(255,255,255,0.42)";
const WEBHOOK_STROKE = "var(--amber)";

export function edgeStyleFor(type: ConnectionType): CSSProperties {
  const base: CSSProperties = {
    stroke: SYNC_STROKE,
    strokeWidth: 1.5,
  };
  switch (type) {
    case "sync":
      return base;
    case "async":
      return { ...base, strokeDasharray: "6 4" };
    case "event":
      // Finer dashes than `async` so the visual is consistent with
      // "this is also async-ish" while leaving room for the spec
      // to call out a distinct rendering later.
      return { ...base, strokeDasharray: "2 4" };
    case "webhook":
      return { ...base, stroke: WEBHOOK_STROKE, strokeWidth: 2 };
  }
}
