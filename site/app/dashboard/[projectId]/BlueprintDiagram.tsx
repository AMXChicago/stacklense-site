"use client";

/**
 * Blueprint architecture diagram — full rebuild.
 *
 * Previous iterations grouped components by lifecycle category. That's
 * the right LIST view, but it's the wrong DIAGRAM view. A blueprint
 * diagram should answer "how do the pieces fit together?" — for which
 * the right unit is the component (each AWS service is its own box),
 * not the category bucket.
 *
 * Layout, top to bottom:
 *
 *   1. Project hero — name + summary + stats. Anchors identity.
 *
 *   2. Platform filter row — clickable chips for each detected
 *      platform (AWS, OpenAI, Vercel, GitHub, etc.) with vendor logo
 *      and component count. Click a chip to highlight that platform's
 *      components and dim the rest. Click again to clear.
 *
 *   3. Architecture canvas — React Flow with dagre auto-layout
 *      (rankdir TB). Each component is a node with vendor logo + name +
 *      platform-coloured border. Edges come from the LLM's
 *      component-level connections plus a small set of canonical
 *      defaults inferred from typical web-app architecture (DNS →
 *      ALB → compute → backing services).
 *
 * Why React Flow + dagre: hand-rolling auto-layout, edge routing, and
 * pan/zoom for variable-shape architecture diagrams was producing
 * broken results in earlier iterations. RF is built for this; we just
 * style its nodes/edges to match our card aesthetic so the canvas
 * doesn't feel like a foreign embed. No mini-map, no chrome buttons,
 * no canvas border — just nodes, edges, and the page background.
 *
 * Future work: the structure is set up to add an animated
 * "user journey" walkthrough (request flowing edge by edge) without
 * changing the layout — each edge already has a stable id.
 */

import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { VendorLogo } from "./VendorLogo";

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

// ----------------------------------------------------------------------------
// Platform inference
// ----------------------------------------------------------------------------

type PlatformKey =
  | "aws"
  | "vercel"
  | "cloudflare"
  | "gcp"
  | "azure"
  | "github"
  | "gitlab"
  | "supabase"
  | "openai"
  | "anthropic"
  | "stripe"
  | "nodejs"
  | "nextjs"
  | "react"
  | "registrar"
  | "other";

type PlatformInfo = {
  key: PlatformKey;
  name: string;
  color: string;
  logoVendor: string;
};

const PLATFORM_META: Record<PlatformKey, PlatformInfo> = {
  aws: { key: "aws", name: "AWS", color: "#ff9900", logoVendor: "Amazon Web Services" },
  vercel: { key: "vercel", name: "Vercel", color: "#ffffff", logoVendor: "Vercel" },
  cloudflare: { key: "cloudflare", name: "Cloudflare", color: "#f38020", logoVendor: "Cloudflare" },
  gcp: { key: "gcp", name: "Google Cloud", color: "#4285f4", logoVendor: "Google Cloud" },
  azure: { key: "azure", name: "Microsoft Azure", color: "#0078d4", logoVendor: "Azure" },
  github: { key: "github", name: "GitHub", color: "#a8a79f", logoVendor: "GitHub" },
  gitlab: { key: "gitlab", name: "GitLab", color: "#fc6d26", logoVendor: "GitLab" },
  supabase: { key: "supabase", name: "Supabase", color: "#3ecf8e", logoVendor: "Supabase" },
  openai: { key: "openai", name: "OpenAI", color: "#10a37f", logoVendor: "OpenAI" },
  anthropic: { key: "anthropic", name: "Anthropic", color: "#d97757", logoVendor: "Anthropic" },
  stripe: { key: "stripe", name: "Stripe", color: "#635bff", logoVendor: "Stripe" },
  nodejs: { key: "nodejs", name: "Node.js", color: "#3dd68c", logoVendor: "Node.js" },
  nextjs: { key: "nextjs", name: "Next.js", color: "#ffffff", logoVendor: "Next.js" },
  react: { key: "react", name: "React", color: "#61dafb", logoVendor: "React" },
  registrar: { key: "registrar", name: "Domain registrar", color: "#a8a79f", logoVendor: "GoDaddy" },
  other: { key: "other", name: "Other", color: "#888888", logoVendor: "" },
};

function inferPlatform(name: string | undefined | null): PlatformKey {
  if (!name) return "other";
  const v = name.toLowerCase();
  if (/amazon|^aws\b|aws /.test(v)) return "aws";
  if (/vercel/.test(v)) return "vercel";
  if (/cloudflare/.test(v)) return "cloudflare";
  if (/google cloud|gcp\b/.test(v)) return "gcp";
  if (/azure|microsoft/.test(v)) return "azure";
  if (/github/.test(v)) return "github";
  if (/gitlab/.test(v)) return "gitlab";
  if (/supabase/.test(v)) return "supabase";
  if (/openai|chatgpt|codex/.test(v)) return "openai";
  if (/anthropic|claude/.test(v)) return "anthropic";
  if (/stripe/.test(v)) return "stripe";
  if (/^next\.?js/.test(v)) return "nextjs";
  if (/node\.?js|^node\b/.test(v)) return "nodejs";
  if (/^react\b/.test(v)) return "react";
  if (/godaddy|namecheap|porkbun|name\.com/.test(v)) return "registrar";
  return "other";
}

// ----------------------------------------------------------------------------
// Custom node + layout
// ----------------------------------------------------------------------------

const NODE_WIDTH = 240;
const NODE_HEIGHT = 80;

type ComponentNodeData = {
  name: string;
  vendor: string;
  description: string;
  console_url?: string;
  platform: PlatformKey;
  color: string;
  dimmed: boolean;
};

function ComponentNode({ data }: NodeProps<ComponentNodeData>) {
  const inner = (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ visibility: "hidden" }}
      />
      <div className="arch-node-logo">
        <VendorLogo vendor={data.vendor} size={32} />
      </div>
      <div className="arch-node-text">
        <div className="arch-node-name">{data.name}</div>
        <div className="arch-node-vendor">{data.vendor}</div>
      </div>
      {data.console_url && (
        <span className="arch-node-arrow" aria-hidden>
          ↗
        </span>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ visibility: "hidden" }}
      />
    </>
  );

  const className = `arch-node ${data.dimmed ? "arch-node-dimmed" : ""}`;
  const style = {
    width: NODE_WIDTH,
    minHeight: NODE_HEIGHT,
    ["--arch-color" as string]: data.color,
  };

  if (data.console_url) {
    return (
      <a
        href={data.console_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} arch-node-link`}
        style={style}
        title={`Open ${data.name} in vendor console`}
      >
        {inner}
      </a>
    );
  }
  return (
    <div className={className} style={style}>
      {inner}
    </div>
  );
}

const NODE_TYPES = { component: ComponentNode };

function layoutWithDagre(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 50,
    ranksep: 90,
    marginx: 20,
    marginy: 20,
  });

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  let maxX = 0;
  let maxY = 0;
  const positioned = nodes.map((n) => {
    const pos = g.node(n.id);
    const x = (pos?.x ?? 0) - NODE_WIDTH / 2;
    const y = (pos?.y ?? 0) - NODE_HEIGHT / 2;
    maxX = Math.max(maxX, x + NODE_WIDTH);
    maxY = Math.max(maxY, y + NODE_HEIGHT);
    return { ...n, position: { x, y } };
  });

  return { nodes: positioned, width: maxX + 40, height: maxY + 40 };
}

// ----------------------------------------------------------------------------
// Canonical edge inference (for when LLM connections are sparse)
// ----------------------------------------------------------------------------

/**
 * If the LLM didn't emit connections for the typical web-app spine,
 * fill them in by category. Picks the FIRST component in each category
 * as the representative; users can verify in the List view.
 *
 *   DNS → entry compute (load balancer or first hosting compute)
 *   App framework → first hosting compute
 *   First hosting compute → first data store
 *   First hosting compute → first auth provider
 *   First hosting compute → first comms provider
 *   First hosting compute → first observability tool
 */
function inferDefaultConnections(
  categories: DiagramCategory[],
  existing: DiagramConnection[]
): DiagramConnection[] {
  const byKey = new Map(categories.map((c) => [c.key, c]));
  const first = (key: string): DiagramComponent | undefined =>
    byKey.get(key)?.components[0];

  const have = new Set(existing.map((c) => `${c.from}|${c.to}`));
  const out: DiagramConnection[] = [];
  const tryAdd = (
    from: DiagramComponent | undefined,
    to: DiagramComponent | undefined,
    label: string
  ) => {
    if (!from || !to || from.id === to.id) return;
    const key = `${from.id}|${to.id}`;
    if (have.has(key)) return;
    have.add(key);
    out.push({ from: from.id, to: to.id, label });
  };

  const dns = first("domains_dns");
  // For "entry" compute prefer a load balancer if one exists in the
  // hosting category; otherwise the first hosting component.
  const hosting = byKey.get("hosting_compute")?.components ?? [];
  const lb = hosting.find((c) =>
    /load balancer|alb|elb|cloudfront|ingress/i.test(`${c.name} ${c.vendor ?? ""}`)
  );
  const compute = hosting.find((c) =>
    /ecs|fargate|lambda|app runner|kubernetes|vercel|netlify|fly\.io|render|cloud run/i.test(
      `${c.name} ${c.vendor ?? ""}`
    )
  );
  const entry = lb ?? compute ?? hosting[0];
  const main = compute ?? hosting[0];

  tryAdd(dns, entry, "resolves to");
  if (lb && main && lb.id !== main.id) {
    tryAdd(lb, main, "routes to");
  }
  tryAdd(first("application_stack"), main, "runs on");
  tryAdd(main, first("data_storage"), "reads / writes");
  tryAdd(main, first("authentication"), "signs users in");
  tryAdd(main, first("communications"), "sends email");
  tryAdd(main, first("payments"), "charges via");
  tryAdd(main, first("observability"), "logs to");
  tryAdd(first("security_secrets"), main, "provides credentials");
  // CI/CD typically deploys TO compute.
  tryAdd(first("ci_cd"), main, "deploys to");

  return [...existing, ...out];
}

// ----------------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------------

export function BlueprintDiagram({
  projectName,
  projectSummary,
  categories,
  connections = [],
}: {
  projectName: string;
  projectSummary?: string | null;
  categories: DiagramCategory[];
  connections?: DiagramConnection[];
}) {
  const [selectedPlatform, setSelectedPlatform] =
    useState<PlatformKey | null>(null);

  // Flatten components and infer platform per item.
  const flatComponents = useMemo(() => {
    return categories.flatMap((cat) =>
      cat.components.map((c) => ({
        ...c,
        categoryKey: cat.key,
        platform: inferPlatform(c.vendor ?? c.name),
      }))
    );
  }, [categories]);

  const totalComponents = flatComponents.length;

  // Distinct platforms (with counts) — for the filter row.
  const platforms = useMemo(() => {
    const counts = new Map<PlatformKey, number>();
    for (const c of flatComponents) {
      counts.set(c.platform, (counts.get(c.platform) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => ({ ...PLATFORM_META[key], count }))
      // Hide "other" from the filter row — it's a catch-all and not
      // useful as a filter target.
      .filter((p) => p.key !== "other")
      .sort((a, b) => b.count - a.count);
  }, [flatComponents]);

  // Build edges: LLM connections + canonical defaults.
  const allConnections = useMemo(() => {
    return inferDefaultConnections(categories, connections);
  }, [categories, connections]);

  // Build React Flow nodes & edges. Layout via dagre, but the actual
  // canvas height is fixed by CSS (75vh) — so the diagram occupies a
  // consistent viewport-sized hero regardless of node count.
  const { positionedNodes, edges } = useMemo(() => {
    const ids = new Set(flatComponents.map((c) => c.id));

    const rawNodes: Node<ComponentNodeData>[] = flatComponents.map((c) => ({
      id: c.id,
      type: "component",
      position: { x: 0, y: 0 },
      data: {
        name: c.name,
        vendor: c.vendor ?? c.name,
        description: c.description,
        console_url: c.console_url,
        platform: c.platform,
        color: PLATFORM_META[c.platform].color,
        dimmed:
          selectedPlatform !== null && c.platform !== selectedPlatform,
      },
    }));

    const rawEdges: Edge[] = allConnections
      .filter((c) => ids.has(c.from) && ids.has(c.to))
      .map((c, i) => {
        // Edge dimming follows node dimming: edges where BOTH endpoints
        // are in the selected platform stay bright; everything else
        // dims with the unselected nodes.
        const fromComp = flatComponents.find((x) => x.id === c.from);
        const toComp = flatComponents.find((x) => x.id === c.to);
        const dimmed =
          selectedPlatform !== null &&
          (fromComp?.platform !== selectedPlatform ||
            toComp?.platform !== selectedPlatform);
        return {
          id: `e-${i}-${c.from}-${c.to}`,
          source: c.from,
          target: c.to,
          label: c.label,
          type: "smoothstep",
          animated: false,
          style: {
            stroke: dimmed ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.4)",
            strokeWidth: 1.5,
            transition: "stroke 0.2s",
          },
          labelStyle: {
            fill: dimmed ? "rgba(168,167,159,0.3)" : "#a8a79f",
            fontFamily: "monospace",
            fontSize: 10,
          },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 4,
          labelBgStyle: {
            fill: "#0c0c0a",
            fillOpacity: dimmed ? 0.5 : 0.9,
          },
        };
      });

    const laid = layoutWithDagre(rawNodes, rawEdges);
    return {
      positionedNodes: laid.nodes,
      edges: rawEdges,
    };
    // selectedPlatform recomputes node/edge data; flatComponents and
    // allConnections feed into both layout and styling.
  }, [flatComponents, allConnections, selectedPlatform]);

  if (totalComponents === 0) {
    return (
      <div className="project-empty">
        <p>
          The lens scanned your project but didn&rsquo;t detect any
          components yet. Try regenerating, or connect a richer source
          (GitHub repo) for more to analyse.
        </p>
      </div>
    );
  }

  const populatedCategories = categories.filter(
    (c) => c.components.length > 0
  ).length;

  // Project identity (name + summary) is now carried by the page's
  // sticky header. Inside the diagram we just show a slim stats line
  // alongside the platform chips so the canvas itself dominates the
  // hero. `projectName` and `projectSummary` props are kept for
  // backward compat but no longer rendered here.
  void projectName;
  void projectSummary;

  return (
    <div className="arch-board">
      <PlatformFilterRow
        platforms={platforms}
        selected={selectedPlatform}
        onSelect={(key) =>
          setSelectedPlatform((prev) => (prev === key ? null : key))
        }
        stats={{ totalComponents, populatedCategories }}
      />

      <div className="arch-canvas">
        <ReactFlow
          nodes={positionedNodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.12, minZoom: 0.5, maxZoom: 1.1 }}
          minZoom={0.4}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          panOnDrag={true}
          zoomOnScroll={false}
          zoomOnPinch={true}
          zoomOnDoubleClick={false}
        >
          <Background gap={32} size={1} color="rgba(255,255,255,0.03)" />
        </ReactFlow>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function PlatformFilterRow({
  platforms,
  selected,
  onSelect,
  stats,
}: {
  platforms: Array<PlatformInfo & { count: number }>;
  selected: PlatformKey | null;
  onSelect: (key: PlatformKey) => void;
  stats: { totalComponents: number; populatedCategories: number };
}) {
  if (platforms.length === 0) return null;
  return (
    <div className="arch-platforms">
      <div className="arch-platforms-meta">
        <span className="arch-platforms-label">Platforms</span>
        <span className="arch-platforms-stats">
          <strong>{stats.totalComponents}</strong> components ·{" "}
          <strong>{stats.populatedCategories}</strong> of 12 categories
        </span>
      </div>
      <div className="arch-platforms-chips" role="tablist">
        {platforms.map((p) => {
          const active = selected === p.key;
          return (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(p.key)}
              className={`arch-chip ${active ? "arch-chip-active" : ""}`}
              style={{ ["--chip-color" as string]: p.color }}
            >
              <span className="arch-chip-logo">
                <VendorLogo vendor={p.logoVendor} size={20} />
              </span>
              <span className="arch-chip-name">{p.name}</span>
              <span className="arch-chip-count">{p.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

