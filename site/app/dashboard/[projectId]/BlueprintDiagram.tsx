"use client";

/**
 * Blueprint diagram — project-hero + category grid.
 *
 * Reads top-down as a single visual answer to the question
 * "what IS this project, and what's it built from?":
 *
 *   1. Hero header — project name + one-sentence summary at the top.
 *      The customer sees their project's identity first, not a wall of
 *      stack jargon.
 *
 *   2. Connecting line — a subtle vertical rule + chevron from the
 *      hero down into the grid. Implies "everything below is what
 *      makes this project tick."
 *
 *   3. Category grid — 12 cards in a responsive grid (4 across on
 *      desktop, 1 on mobile). Each card has:
 *        - colour-accented header
 *        - plain-English title (e.g. "Where it runs" instead of
 *          "Hosting & compute")
 *        - one-line subtitle so the customer never has to guess what
 *          a category means
 *        - component tiles inside, each clickable through to the
 *          vendor's own console.
 *
 * Native HTML/CSS — no React Flow canvas. The diagram is part of the
 * page, scrolls with it, inherits the page's typography. Feels like
 * "the project's blueprint" rather than "an embedded widget".
 */

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

/**
 * Plain-English title + subtitle for each canonical category. The
 * jargon name (e.g. "Hosting & compute") still shows as a small
 * caption so technical users can still recognise it, but the customer
 * reads the friendly title first.
 */
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
    subtitle: "Databases, file storage, and caches.",
    color: "#3b82f6",
  },
  authentication: {
    title: "User login",
    subtitle: "How people sign in to use your app.",
    color: "#ec4899",
  },
  communications: {
    title: "Email & messaging",
    subtitle: "How your app talks to users.",
    color: "#ef4444",
  },
  domains_dns: {
    title: "Web addresses",
    subtitle: "Your URLs and the system that resolves them.",
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
    subtitle: "API keys, passwords, SSL — the credentials.",
    color: "#f43f5e",
  },
};

export function BlueprintDiagram({
  projectName,
  projectSummary,
  categories,
}: {
  projectName: string;
  projectSummary?: string | null;
  categories: DiagramCategory[];
  // connections is no longer rendered as visual edges — the grid
  // already groups by category, which is what customers actually want
  // to see. Kept on the prop for backward compat with the parent.
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

  return (
    <div className="bp-board">
      <ProjectHero
        name={projectName}
        summary={projectSummary}
        totalComponents={totalComponents}
        populatedCategories={populatedCategories}
      />

      {/* Visual connector between the hero and the grid — pure
          decoration, but it's what makes the grid read as "this is
          everything that makes up the project above" instead of a
          loose collection of cards. */}
      <div className="bp-board-link" aria-hidden>
        <div className="bp-board-link-line" />
        <div className="bp-board-link-chevron">▾</div>
      </div>

      <div className="bp-board-grid">
        {categories.map((cat) => (
          <CategoryCard key={cat.key} category={cat} />
        ))}
      </div>
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
  // Take the first letter of each significant word for the mark, max
  // two characters — gives a recognisable monogram without a real
  // logo asset (e.g. "MSP Lighthouse" → "ML", "stacklense" → "S").
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
            {categoryCount()} categories
          </span>
        </p>
      </div>
    </header>
  );
}

function CategoryCard({ category }: { category: DiagramCategory }) {
  const friendly = CATEGORY_FRIENDLY[category.key] ?? {
    title: category.label,
    subtitle: "",
    color: "#888",
  };
  const isEmpty = category.components.length === 0;

  return (
    <article
      className={`bp-board-cat ${isEmpty ? "bp-board-cat-empty" : ""}`}
      style={{ ["--cat-color" as string]: friendly.color }}
    >
      <header className="bp-board-cat-head">
        <h3 className="bp-board-cat-title">{friendly.title}</h3>
        {friendly.subtitle && (
          <p className="bp-board-cat-subtitle">{friendly.subtitle}</p>
        )}
        <p className="bp-board-cat-tech">{category.label}</p>
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
        size={28}
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
// Helpers

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

function categoryCount(): number {
  return Object.keys(CATEGORY_FRIENDLY).length;
}
