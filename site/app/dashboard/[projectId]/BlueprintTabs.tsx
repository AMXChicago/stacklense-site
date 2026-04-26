"use client";

import { useState, type ReactNode } from "react";
import {
  BlueprintDiagram,
  type DiagramCategory,
  type DiagramConnection,
} from "./BlueprintDiagram";
import { BlueprintInventory } from "./BlueprintInventory";

export function BlueprintTabs({
  projectName,
  projectSummary,
  categories,
  connections,
  listView,
  discoverySnapshot,
  discoveryAt,
}: {
  projectName: string;
  projectSummary?: string | null;
  categories: DiagramCategory[];
  connections: DiagramConnection[];
  listView: ReactNode;
  discoverySnapshot: Record<string, unknown> | null;
  discoveryAt: string | null;
}) {
  const [view, setView] = useState<"diagram" | "list" | "inventory">("diagram");
  return (
    <div className="bp-tabs-wrapper">
      <div className="bp-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={view === "diagram"}
          className={`bp-tab ${view === "diagram" ? "bp-tab-active" : ""}`}
          onClick={() => setView("diagram")}
        >
          Diagram
        </button>
        <button
          role="tab"
          aria-selected={view === "list"}
          className={`bp-tab ${view === "list" ? "bp-tab-active" : ""}`}
          onClick={() => setView("list")}
        >
          List
        </button>
        <button
          role="tab"
          aria-selected={view === "inventory"}
          className={`bp-tab ${view === "inventory" ? "bp-tab-active" : ""}`}
          onClick={() => setView("inventory")}
        >
          Inventory
        </button>
      </div>
      {view === "diagram" && (
        <BlueprintDiagram
          projectName={projectName}
          projectSummary={projectSummary}
          categories={categories}
          connections={connections}
        />
      )}
      {view === "list" && <div className="bp-list-pane">{listView}</div>}
      {view === "inventory" && (
        <BlueprintInventory
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          snapshot={discoverySnapshot as any}
          observedAt={discoveryAt}
        />
      )}
    </div>
  );
}
