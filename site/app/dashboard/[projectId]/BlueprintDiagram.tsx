"use client";

/**
 * Blueprint diagram — project hero + connected category grid.
 *
 * Reads top-down:
 *
 *   1. Hero — project name + summary anchors the visual identity.
 *   2. Connector — subtle line + chevron implies "everything below
 *      makes the project above tick".
 *   3. Connected category grid — fixed 4×3 grid with grid-template-
 *      areas so positions are predictable. Each card has a prominent
 *      primary-vendor logo, plain-English title + subtitle, and
 *      clickable component tiles inside.
 *   4. SVG overlay — drawn behind the cards, paints curved paths
 *      between connected categories. Path endpoints sit at card
 *      centres so the visible bit of each path is the segment between
 *      cards (the part inside cards is hidden behind their opaque
 *      backgrounds). Arrowheads at the destination end. Connections
 *      are LLM-generated (aggregated component → component links up
 *      to category level) plus a seed set of canonical architectural
 *      flows so the standard "code → hosting → data, auth, comms,
 *      payments" story is always visible even when the LLM is sparse.
 *
 * Responsive: the 4×3 grid collapses to 2 columns and then 1 column
 * at narrower widths; the SVG overlay hides itself on those layouts
 * (linear stacking already conveys the flow).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const CATEGORY_FRIENDLY: Record<
  string,
  { title: string; subtitle: string; color: string }
> = {
  ai_dev_tools: {
    title: "AI helpers",
    subtitle: "Tools you use to write the code.",
    color: "#a855f7",
  },
  source_control: {
    title: "Code repository",
    subtitle: "Where your code is stored online.",
    color: "#f59e0b",
  },
  ci_cd: {
    title: "Deployment pipeline",
    subtitle: "How code goes from your laptop to live.",
    color: "#06b6d4",
  },
  application_stack: {
    title: "App framework",
    subtitle: "What your app is built with.",
    color: "#3dd68c",
  },
  hosting_compute: {
    title: "Where it runs",
    subtitle: "The servers that keep your app online.",
    color: "#8b5cf6",
  },
  data_storage: {
    title: "Data & files",
    subtitle: "Databases, file storage, caches.",
    color: "#3b82f6",
  },
  authentication: {
    title: "User login",
    subtitle: "How people sign in.",
    color: "#ec4899",
  },
  communications: {
    title: "Email & messaging",
    subtitle: "How your app talks to users.",
    color: "#ef4444",
  },
  domains_dns: {
    title: "Web addresses",
    subtitle: "Your URLs and DNS resolution.",
    color: "#a8a79f",
  },
  payments: {
    title: "Payments",
    subtitle: "How your app accepts money.",
    color: "#22c55e",
  },
  observability: {
    title: "Logs & alerts",
    subtitle: "How you spot problems.",
    color: "#0ea5e9",
  },
  security_secrets: {
    title: "Secrets & certificates",
    subtitle: "API keys, passwords, SSL.",
    color: "#f43f5e",
  },
};

/**
 * Fixed grid placement. 4 columns × 3 rows. Order matches the
 * canonical category list, with hosting placed at row-2 col-1 so it
 * naturally becomes the central hub for the connection paths.
 */
const GRID_AREAS: Array<Array<string>> = [
  ["ai_dev_tools", "source_control", "ci_cd", "application_stack"],
  ["hosting_compute", "data_storage", "authentication", "communications"],
  ["domains_dns", "payments", "observability", "security_secrets"],
];

/**
 * Canonical architectural flows. Always rendered when both ends have
 * components. The LLM's component-level connections are aggregated to
 * category level and merged in, so the diagram reflects the actual
 * project too.
 */
const DEFAULT_CONNECTIONS: DiagramConnection[] = [
  { from: "source_control", to: "ci_cd", label: "pushes" },
  { from: "ci_cd", to: "hosting_compute", label: "deploys to" },
  { from: "application_stack", to: "hosting_compute", label: "runs on" },
  { from: "domains_dns", to: "hosting_compute", label: "resolves to" },
  { from: "hosting_compute", to: "data_storage", label: "reads / writes" },
  { from: "hosting_compute", to: "authentication", label: "signs users in" },
  { from: "hosting_compute", to: "communications", label: "sends email" },
  { from: "hosting_compute", to: "payments", label: "charges via" },
  { from: "hosting_compute", to: "observability", label: "logs to" },
  { from: "security_secrets", to: "hosting_compute", label: "provides secrets" },
];

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
  const totalComponents = categories.reduce(
    (sum, c) => sum + c.components.length,
    0
  );
  const populatedCategories = categories.filter(
    (c) => c.components.length > 0
  ).length;

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

  // Build the set of category-level connections to render. Start with
  // the canonical architectural flows, then merge in any extra ones
  // the LLM produced at component level.
  const componentToCategory = new Map<string, string>();
  for (const cat of categories) {
    for (const c of cat.components) {
      componentToCategory.set(c.id, cat.key);
    }
  }
  const categoryConnections = aggregateAndMerge(
    DEFAULT_CONNECTIONS,
    connections,
    componentToCategory
  );

  // Filter to connections where both ends have components — no point
  // drawing "DNS → Hosting" if the customer has no DNS detected.
  const populated = new Set(
    categories.filter((c) => c.components.length > 0).map((c) => c.key)
  );
  const activeConnections = categoryConnections.filter(
    (c) => populated.has(c.from) && populated.has(c.to)
  );

  return (
    <div className="bp-board">
      <ProjectHero
        name={projectName}
        summary={projectSummary}
        totalComponents={totalComponents}
        populatedCategories={populatedCategories}
      />

      <div className="bp-board-link" aria-hidden>
        <div className="bp-board-link-line" />
        <div className="bp-board-link-chevron">▾</div>
      </div>

      <ConnectedGrid
        categories={categories}
        connections={activeConnections}
      />
    </div>
  );
}

function ProjectHero({
  name,
  summary,
  totalComponents,
  populatedCategories,
}: {
  name: string;
  summary?: string | null;
  totalComponents: number;
  populatedCategories: number;
}) {
  const mark = monogramFromName(name);
  return (
    <header className="bp-board-hero">
      <div className="bp-board-mark" aria-hidden>
        {mark}
      </div>
      <div className="bp-board-hero-text">
        <h2 className="bp-board-name">{name}</h2>
        {summary && <p className="bp-board-summary">{summary}</p>}
        <p className="bp-board-stats">
          <span className="bp-board-stat">
            <strong>{totalComponents}</strong> component
            {totalComponents === 1 ? "" : "s"} detected
          </span>
          <span className="bp-board-stat-sep" aria-hidden>
            ·
          </span>
          <span className="bp-board-stat">
            across <strong>{populatedCategories}</strong> of{" "}
            {Object.keys(CATEGORY_FRIENDLY).length} categories
          </span>
        </p>
      </div>
    </header>
  );
}

/**
 * The grid + the SVG overlay layered above it. The grid uses
 * grid-template-areas so each card has a known position the overlay
 * can draw paths between via runtime DOM measurement.
 */
function ConnectedGrid({
  categories,
  connections,
}: {
  categories: DiagramCategory[];
  connections: DiagramConnection[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  // Lookup by category key — handy for the cards.
  const byKey = new Map(categories.map((c) => [c.key, c]));

  return (
    <div className="bp-board-grid-wrap" ref={containerRef}>
      <ConnectionOverlay
        containerRef={containerRef}
        cardRefs={cardRefs}
        connections={connections}
      />
      <div className="bp-board-grid">
        {GRID_AREAS.flat().map((key) => {
          const cat = byKey.get(key);
          if (!cat) return null;
          return (
            <CategoryCard
              key={key}
              gridArea={key}
              category={cat}
              setRef={(el) => {
                cardRefs.current[key] = el;
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  gridArea,
  setRef,
}: {
  category: DiagramCategory;
  gridArea: string;
  setRef: (el: HTMLElement | null) => void;
}) {
  const friendly = CATEGORY_FRIENDLY[category.key] ?? {
    title: category.label,
    subtitle: "",
    color: "#888",
  };
  const isEmpty = category.components.length === 0;
  // Primary vendor for the hero logo on this card. Falls back to the
  // first component's name when no vendor is set.
  const primary = category.components[0];
  const primaryVendor = primary?.vendor ?? primary?.name;

  return (
    <article
      ref={setRef}
      className={`bp-board-cat ${isEmpty ? "bp-board-cat-empty" : ""}`}
      style={{
        ["--cat-color" as string]: friendly.color,
        gridArea,
      }}
    >
      <header className="bp-board-cat-head">
        <div className="bp-board-cat-logo">
          {primaryVendor ? (
            <VendorLogo vendor={primaryVendor} size={44} />
          ) : (
            <div className="bp-board-cat-logo-placeholder" aria-hidden />
          )}
        </div>
        <div className="bp-board-cat-head-text">
          <h3 className="bp-board-cat-title">{friendly.title}</h3>
          {friendly.subtitle && (
            <p className="bp-board-cat-subtitle">{friendly.subtitle}</p>
          )}
          <p className="bp-board-cat-tech">{category.label}</p>
        </div>
      </header>
      <div className="bp-board-cat-body">
        {isEmpty ? (
          <div className="bp-board-cat-not-detected">
            Not detected — either you don&rsquo;t use this, or our scan
            didn&rsquo;t spot it.
          </div>
        ) : (
          <ul className="bp-board-comps">
            {category.components.map((c) => (
              <li key={c.id}>
                <ComponentTile component={c} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function ComponentTile({ component }: { component: DiagramComponent }) {
  const inner = (
    <>
      <VendorLogo
        vendor={component.vendor ?? component.name}
        size={24}
      />
      <div className="bp-board-comp-text">
        <div className="bp-board-comp-name">{component.name}</div>
        {component.vendor && component.vendor !== component.name && (
          <div className="bp-board-comp-vendor">{component.vendor}</div>
        )}
      </div>
      {component.console_url && (
        <span className="bp-board-comp-arrow" aria-hidden>
          ↗
        </span>
      )}
    </>
  );
  if (component.console_url) {
    return (
      <a
        href={component.console_url}
        target="_blank"
        rel="noopener noreferrer"
        className="bp-board-comp bp-board-comp-link"
        title={`Open ${component.name} in vendor console`}
      >
        {inner}
      </a>
    );
  }
  return <div className="bp-board-comp">{inner}</div>;
}

// ----------------------------------------------------------------------------
// SVG connection overlay
// ----------------------------------------------------------------------------

type ResolvedPath = {
  key: string;
  d: string; // SVG path
  label?: string;
  midX: number;
  midY: number;
  color: string;
};

/**
 * Sits absolutely positioned over the grid wrapper. Measures card
 * positions via getBoundingClientRect and draws curved bezier paths
 * between connected category cards. Re-measures on resize via a
 * ResizeObserver. Hides itself on narrow viewports where the grid
 * collapses to a single column.
 */
function ConnectionOverlay({
  containerRef,
  cardRefs,
  connections,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  cardRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  connections: DiagramConnection[];
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [paths, setPaths] = useState<ResolvedPath[]>([]);

  const measure = () => {
    const c = containerRef.current;
    if (!c) return;
    const cb = c.getBoundingClientRect();
    setSize({ w: cb.width, h: cb.height });

    const next: ResolvedPath[] = [];
    for (const conn of connections) {
      const fromEl = cardRefs.current[conn.from];
      const toEl = cardRefs.current[conn.to];
      if (!fromEl || !toEl) continue;
      const fb = fromEl.getBoundingClientRect();
      const tb = toEl.getBoundingClientRect();

      // Card centres in container-relative coords.
      const fcx = fb.left + fb.width / 2 - cb.left;
      const fcy = fb.top + fb.height / 2 - cb.top;
      const tcx = tb.left + tb.width / 2 - cb.left;
      const tcy = tb.top + tb.height / 2 - cb.top;

      // Route the path from one card EDGE to the other card EDGE
      // (rather than centre-to-centre) so the entire path lives in
      // the gap between cards and doesn't depend on z-index or
      // opaque backgrounds to hide a portion behind a card. The
      // dominant axis between the two cards' centres picks which
      // edges to use.
      const dx = tcx - fcx;
      const dy = tcy - fcy;
      let fx: number, fy: number, tx: number, ty: number;
      let curveAxis: "h" | "v";
      if (Math.abs(dx) >= Math.abs(dy)) {
        curveAxis = "h";
        if (dx > 0) {
          fx = fb.right - cb.left;
          fy = fcy;
          tx = tb.left - cb.left;
          ty = tcy;
        } else {
          fx = fb.left - cb.left;
          fy = fcy;
          tx = tb.right - cb.left;
          ty = tcy;
        }
      } else {
        curveAxis = "v";
        if (dy > 0) {
          fx = fcx;
          fy = fb.bottom - cb.top;
          tx = tcx;
          ty = tb.top - cb.top;
        } else {
          fx = fcx;
          fy = fb.top - cb.top;
          tx = tcx;
          ty = tb.bottom - cb.top;
        }
      }

      // Bezier control points pulled along the curve's dominant axis
      // for a soft S-curve.
      let c1x: number, c1y: number, c2x: number, c2y: number;
      if (curveAxis === "h") {
        const span = tx - fx;
        c1x = fx + span * 0.5;
        c1y = fy;
        c2x = tx - span * 0.5;
        c2y = ty;
      } else {
        const span = ty - fy;
        c1x = fx;
        c1y = fy + span * 0.5;
        c2x = tx;
        c2y = ty - span * 0.5;
      }

      const d = `M ${fx} ${fy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;

      // Approx midpoint (true bezier midpoint at t=0.5).
      const midX = 0.125 * fx + 0.375 * c1x + 0.375 * c2x + 0.125 * tx;
      const midY = 0.125 * fy + 0.375 * c1y + 0.375 * c2y + 0.125 * ty;

      const color =
        CATEGORY_FRIENDLY[conn.to]?.color ?? "rgba(255,255,255,0.6)";

      next.push({
        key: `${conn.from}->${conn.to}`,
        d,
        label: conn.label,
        midX,
        midY,
        color,
      });
    }
    setPaths(next);
  };

  // useLayoutEffect runs after refs are set & DOM is laid out but
  // before paint — gives us correct geometry on the first render
  // without flicker.
  useLayoutEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(c);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (size.w === 0 || paths.length === 0) return null;

  return (
    <svg
      className="bp-board-overlay"
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      aria-hidden
    >
      <defs>
        {paths.map((p) => (
          <marker
            key={`m-${p.key}`}
            id={`arrow-${p.key}`}
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={p.color} opacity="0.85" />
          </marker>
        ))}
      </defs>
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          stroke={p.color}
          strokeWidth={2.2}
          strokeOpacity={0.85}
          fill="none"
          markerEnd={`url(#arrow-${p.key})`}
        />
      ))}
      {paths.map(
        (p) =>
          p.label && (
            <g key={`l-${p.key}`} className="bp-board-overlay-label">
              <rect
                x={p.midX - approxLabelWidth(p.label) / 2 - 6}
                y={p.midY - 9}
                width={approxLabelWidth(p.label) + 12}
                height={18}
                rx={9}
                ry={9}
                fill="#0c0c0a"
                stroke={p.color}
                strokeOpacity={0.4}
              />
              <text
                x={p.midX}
                y={p.midY + 4}
                textAnchor="middle"
                fontSize={10}
                fontFamily="monospace"
                fill="#a8a79f"
              >
                {p.label}
              </text>
            </g>
          )
      )}
    </svg>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function monogramFromName(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

function approxLabelWidth(label: string): number {
  // Rough monospace width — 6.2px/char at 10px size.
  return label.length * 6.2;
}

/**
 * Aggregate component-level LLM connections up to category level,
 * then merge them with the canonical architectural defaults so we
 * always have the standard "code → hosting → data, auth, comms,
 * payments" backbone. De-duped by (from, to) pair.
 */
function aggregateAndMerge(
  defaults: DiagramConnection[],
  llm: DiagramConnection[],
  componentToCategory: Map<string, string>
): DiagramConnection[] {
  const merged = new Map<string, DiagramConnection>();
  for (const d of defaults) {
    merged.set(`${d.from}|${d.to}`, d);
  }
  for (const c of llm) {
    const fromCat = componentToCategory.get(c.from);
    const toCat = componentToCategory.get(c.to);
    if (!fromCat || !toCat || fromCat === toCat) continue;
    const key = `${fromCat}|${toCat}`;
    if (!merged.has(key)) {
      merged.set(key, { from: fromCat, to: toCat, label: c.label });
    }
  }
  return Array.from(merged.values());
}
