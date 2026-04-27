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
