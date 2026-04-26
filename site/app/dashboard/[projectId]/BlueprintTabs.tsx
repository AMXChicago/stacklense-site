"use client";

import { useState, type ReactNode } from "react";
import {
  BlueprintDiagram,
  type DiagramCategory,
  type DiagramConnection,
} from "./BlueprintDiagram";

export function BlueprintTabs({
  categories,
  connections,
  listView,
}: {
  categories: DiagramCategory[];
  connections: DiagramConnection[];
  listView: ReactNode;
}) {
  const [view, setView] = useState<"diagram" | "list">("diagram");
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
      </div>
      {view === "diagram" ? (
        <BlueprintDiagram
          categories={categories}
          connections={connections}
        />
      ) : (
        <div className="bp-list-pane">{listView}</div>
      )}
    </div>
  );
}
