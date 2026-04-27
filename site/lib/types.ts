/**
 * Spec data model — the shape every part of the dashboard frontend
 * works with. Defined verbatim per docs/blueprint-spec.md "Data
 * model" section.
 *
 * The recursive structure (Service can contain Services via
 * parentId) is deliberate: it lets us drill from project → platform
 * → service → function → module without separate types.
 *
 * The dashboard NEVER reads from Supabase rows directly. Everything
 * passes through lib/project-adapter.ts which produces a Project
 * object matching this spec from whatever the backend stores. If the
 * backend changes shape, only the adapter changes.
 */

export type ISODate = string;

export type ServiceKind = "platform" | "service" | "function" | "module";

export type ServiceStatus = "healthy" | "degraded" | "down" | "unknown";

export type ConnectionType = "sync" | "async" | "webhook" | "event";

export type ActivityKind =
  | "add"
  | "remove"
  | "change"
  | "deploy"
  | "config"
  | "edge";

/**
 * A Metric is pre-formatted by its Provider. The dashboard never
 * computes — it renders `value` as-is. Provider is named in
 * `source` so the inspector can surface provenance.
 */
export type Metric = {
  label: string;
  value: string;
  source: string;
};

export type ServiceMetadata = {
  file?: string;
  lines?: number;
  brandColor?: string;
  // Open-ended: each Provider may contribute platform-specific keys.
  // Documented in lib/project-adapter.ts when added.
  [key: string]: unknown;
};

export type Service = {
  id: string;
  name: string;
  kind: ServiceKind;
  parentId: string | null;
  description?: string;
  status: ServiceStatus;
  metadata: ServiceMetadata;
  metrics: Metric[];
  lastChangedAt?: ISODate;
  createdAt: ISODate;
};

export type Connection = {
  id: string;
  fromServiceId: string;
  toServiceId: string;
  type: ConnectionType;
  what: string;
  schema?: string;
  frequency?: string;
  latency?: string;
  lastChangedAt?: ISODate;
  createdAt: ISODate;
};

export type Activity = {
  id: string;
  kind: ActivityKind;
  summary: string;
  detail: string;
  affectedServiceIds: string[];
  affectedConnectionIds: string[];
  timestamp: ISODate;
  source: string;
};

export type Project = {
  id: string;
  name: string;
  rootServiceIds: string[];
  services: Record<string, Service>;
  connections: Record<string, Connection>;
  activity: Activity[];
};
