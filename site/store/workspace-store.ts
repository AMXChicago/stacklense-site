/**
 * Workspace store — single source of truth for client state in the
 * dashboard workspace. Per spec "Tech stack > State": Zustand, one
 * store, avoid prop-drilling.
 *
 * State scope:
 *   - mode: which mode tab is active (architecture / data flow /
 *     simulate)
 *   - selection: what's selected in the canvas (node, edge, activity
 *     item, or null = inspector empty state)
 *   - drillStack: the recursive drill path. When the user double-
 *     clicks a Service, its id is pushed onto the stack. Esc / back
 *     pops one. Breadcrumb is derived from this.
 *   - filter: which platform IDs the chip filter row has selected
 *     (Set; empty = "All"). Per spec, filter dims, doesn't hide.
 *   - flashedServiceIds: a transient set of IDs to flash (3-second
 *     opacity animation) when the user clicks an activity item.
 *
 * STUB. State shape and actions are scaffolded with empty defaults
 * so types resolve. Selectors land alongside features in spec build
 * steps 1-9.
 */

import { create } from "zustand";

export type Mode = "architecture" | "data-flow" | "simulate";

export type SelectionKind =
  | "none"
  | "service"
  | "connection"
  | "activity";

export type Selection =
  | { kind: "none" }
  | { kind: "service"; id: string }
  | { kind: "connection"; id: string }
  | { kind: "activity"; id: string };

export type WorkspaceState = {
  mode: Mode;
  selection: Selection;
  drillStack: string[];
  filter: ReadonlySet<string>;
  flashedServiceIds: ReadonlySet<string>;

  setMode: (mode: Mode) => void;
  setSelection: (selection: Selection) => void;
  pushDrill: (serviceId: string) => void;
  popDrill: () => void;
  /**
   * Truncate the drill stack to the first `depth` entries.
   *   drillTo(0) ≡ resetDrill (back to project root)
   *   drillTo(1) ≡ keep the first level only
   * Used by breadcrumb segments — clicking the AWS segment from
   * `[aws, lambda]` calls `drillTo(1)` and lands at `[aws]`.
   * Out-of-range depths clamp to [0, current length] so callers
   * can pass an index without bounds-checking first.
   */
  drillTo: (depth: number) => void;
  resetDrill: () => void;
  toggleFilter: (platformId: string) => void;
  clearFilter: () => void;
  flashServices: (ids: string[]) => void;
  clearFlash: () => void;
};

const EMPTY_SET: ReadonlySet<string> = new Set();

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  mode: "architecture",
  selection: { kind: "none" },
  drillStack: [],
  filter: EMPTY_SET,
  flashedServiceIds: EMPTY_SET,

  setMode: (mode) => set({ mode }),
  setSelection: (selection) => set({ selection }),
  pushDrill: (serviceId) =>
    set((s) => ({ drillStack: [...s.drillStack, serviceId] })),
  popDrill: () =>
    set((s) => ({ drillStack: s.drillStack.slice(0, -1) })),
  drillTo: (depth) =>
    set((s) => {
      const clamped = Math.max(0, Math.min(depth, s.drillStack.length));
      // Identity bail-out: if depth already matches, return the same
      // array reference so subscribers don't re-render unnecessarily.
      if (clamped === s.drillStack.length) return {};
      return { drillStack: s.drillStack.slice(0, clamped) };
    }),
  resetDrill: () => set({ drillStack: [] }),
  toggleFilter: (platformId) =>
    set((s) => {
      const next = new Set(s.filter);
      if (next.has(platformId)) next.delete(platformId);
      else next.add(platformId);
      return { filter: next };
    }),
  clearFilter: () => set({ filter: EMPTY_SET }),
  flashServices: (ids) => set({ flashedServiceIds: new Set(ids) }),
  clearFlash: () => set({ flashedServiceIds: EMPTY_SET }),
}));

// Development-only: expose the store on `window.__ws` so it can be
// driven from the browser console / test eval. Useful for verifying
// rendering invariants without depending on React Flow's pointer-
// event system (which is fragile under preview-tab throttling).
//
// Guarded by NODE_ENV — never present in a production build, so this
// cannot be used as an attack vector or accidental coupling. Zustand
// stores are functions with `.getState`, `.setState`, `.subscribe`
// methods — exposing them is the documented pattern for debug.
if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV !== "production"
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as unknown as { __ws?: unknown }).__ws = useWorkspaceStore;
}
