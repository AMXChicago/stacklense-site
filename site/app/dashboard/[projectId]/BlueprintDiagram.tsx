"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";

export type DiagramComponent = {
  id: string;
  name: string;
  vendor?: string;
  description: string;
  evidence?: string;
  console_url?: string;
};

export type DiagramCategory = {
  key: string;
  label: string;
  components: DiagramComponent[];
};

export type DiagramConnection = {
  from: string;
  to: string;
  label?: string;
};

const CATEGORY_LAYOUT: Record<string, { col: number; row: number }> = {
  ai_dev_tools: { col: 0, row: 0 },
  source_control: { col: 1, row: 0 },
  ci_cd: { col: 2, row: 0 },
  application_stack: { col: 3, row: 0 },
  hosting_compute: { col: 0, row: 1 },
  data_storage: { col: 1, row: 1 },
  authentication: { col: 2, row: 1 },
  communications: { col: 3, row: 1 },
  domains_dns: { col: 0, row: 2 },
  payments: { col: 1, row: 2 },
  observability: { col: 2, row: 2 },
  security_secrets: { col: 3, row: 2 },
};

const CATEGORY_COLORS: Record<string, string> = {
  ai_dev_tools: "#3dd68c",
  source_control: "#f59e0b",
  ci_cd: "#a855f7",
  application_stack: "#3dd68c",
  hosting_compute: "#8b5cf6",
  data_storage: "#3b82f6",
  authentication: "#ec4899",
  communications: "#ef4444",
  domains_dns: "#a8a79f",
  payments: "#22c55e",
  observability: "#06b6d4",
  security_secrets: "#f43f5e",
};

const COL_WIDTH = 240;
const COL_GAP = 24;
const ROW_HEIGHT = 280;
const HEADER_HEIGHT = 32;
const NODE_HEIGHT = 76;
const NODE_GAP = 10;

function layoutNodes(
  categories: DiagramCategory[]
): { nodes: Node[]; widthPx: number; heightPx: number } {
  const nodes: Node[] = [];
  let maxCol = 0;
  let maxRow = 0;

  for (const cat of categories) {
    const layout = CATEGORY_LAYOUT[cat.key];
    if (!layout) continue;
    maxCol = Math.max(maxCol, layout.col);
    maxRow = Math.max(maxRow, layout.row);

    const baseX = layout.col * (COL_WIDTH + COL_GAP);
    const baseY = layout.row * ROW_HEIGHT;
    const color = CATEGORY_COLORS[cat.key] ?? "#888";

    nodes.push({
      id: `cat-${cat.key}`,
      type: "category",
      position: { x: baseX, y: baseY },
      data: {
        label: cat.label,
        color,
        empty: cat.components.length === 0,
      },
      style: { width: COL_WIDTH },
      draggable: false,
      selectable: false,
    });

    cat.components.forEach((c, i) => {
      nodes.push({
        id: c.id,
        type: "component",
        position: {
          x: baseX,
          y: baseY + HEADER_HEIGHT + 12 + i * (NODE_HEIGHT + NODE_GAP),
        },
        data: { ...c, color },
        style: { width: COL_WIDTH },
      });
    });
  }

  const widthPx = (maxCol + 1) * (COL_WIDTH + COL_GAP);
  const heightPx = (maxRow + 1) * ROW_HEIGHT + 80;

  return { nodes, widthPx, heightPx };
}

function buildEdges(
  connections: DiagramConnection[],
  validIds: Set<string>
): Edge[] {
  return connections
    .filter((c) => validIds.has(c.from) && validIds.has(c.to))
    .map((c, i) => ({
      id: `edge-${i}`,
      source: c.from,
      target: c.to,
      label: c.label,
      animated: false,
      type: "smoothstep",
      style: { stroke: "rgba(255,255,255,0.25)", strokeWidth: 1.5 },
      labelStyle: {
        fill: "#a8a79f",
        fontFamily: "monospace",
        fontSize: 10,
      },
      labelBgStyle: {
        fill: "#0c0c0a",
        fillOpacity: 0.85,
      },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 4,
    }));
}

function CategoryNode({
  data,
}: {
  data: { label: string; color: string; empty: boolean };
}) {
  return (
    <div className="diag-cat-header" style={{ borderColor: data.color }}>
      <div
        className="diag-cat-dot"
        style={{ background: data.color }}
        aria-hidden
      />
      <span className="diag-cat-label">{data.label}</span>
      {data.empty && <span className="diag-cat-empty">empty</span>}
    </div>
  );
}

function ComponentNode({
  data,
}: {
  data: DiagramComponent & { color: string };
}) {
  const inner = (
    <>
      <div className="diag-node-name">{data.name}</div>
      {data.vendor && data.vendor !== data.name && (
        <div className="diag-node-vendor">{data.vendor}</div>
      )}
    </>
  );
  return (
    <div className="diag-node" style={{ borderLeftColor: data.color }}>
      {data.console_url ? (
        <a
          href={data.console_url}
          target="_blank"
          rel="noopener noreferrer"
          className="diag-node-link"
        >
          {inner}
          <span className="diag-node-arrow">↗</span>
        </a>
      ) : (
        <div className="diag-node-link diag-node-link-static">{inner}</div>
      )}
      {data.description && (
        <div className="diag-node-desc">{data.description}</div>
      )}
    </div>
  );
}

const NODE_TYPES = {
  category: CategoryNode,
  component: ComponentNode,
};

export function BlueprintDiagram({
  categories,
  connections,
}: {
  categories: DiagramCategory[];
  connections: DiagramConnection[];
}) {
  const { nodes, heightPx } = useMemo(
    () => layoutNodes(categories),
    [categories]
  );

  const edges = useMemo(() => {
    const ids = new Set(
      categories.flatMap((c) => c.components.map((comp) => comp.id))
    );
    return buildEdges(connections, ids);
  }, [categories, connections]);

  const hasComponents = categories.some((c) => c.components.length > 0);

  if (!hasComponents) {
    return (
      <div className="project-empty">
        <p>
          The lens scanned your project but didn&rsquo;t detect anything yet.
          Try regenerating, or connect a richer source (GitHub repo) for more
          to analyze.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bp-diagram-wrapper"
      style={{ width: "100%", height: heightPx + 60 }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.4}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background gap={32} size={1} color="rgba(255,255,255,0.04)" />
        <Controls
          showInteractive={false}
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border2)",
          }}
        />
      </ReactFlow>
    </div>
  );
}
