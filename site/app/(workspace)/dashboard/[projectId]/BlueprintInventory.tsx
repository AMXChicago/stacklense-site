"use client";

/**
 * Raw view of what StackLense observed in the customer's AWS account.
 * Lets the user verify the blueprint against ground truth — anything in
 * the inventory but missing from the blueprint is a gap to investigate.
 */

type DiscoverySnapshot = {
  account_id?: string;
  region?: string;
  ecr_repos?: Array<{ name?: string; uri?: string }>;
  ecs_clusters?: Array<{
    name?: string;
    services?: Array<{
      name?: string;
      launch_type?: string;
      desired_count?: number;
      running_count?: number;
      container_images?: string[];
    }>;
  }>;
  s3_buckets?: Array<{ name?: string; region?: string }>;
  log_groups?: Array<{ name?: string; retention_days?: number }>;
  load_balancers?: Array<{
    name?: string;
    type?: string;
    scheme?: string;
    dns?: string;
  }>;
  hosted_zones?: Array<{
    name?: string;
    private?: boolean;
    record_count?: number;
  }>;
  secrets?: Array<{ name?: string; description?: string }>;
  lambda_functions?: Array<{ name?: string; runtime?: string }>;
  cloudfront_distributions?: Array<{
    domain?: string;
    aliases?: string[];
  }>;
  rds_instances?: Array<{
    id?: string;
    engine?: string;
    engine_version?: string;
  }>;
  rds_clusters?: Array<{
    id?: string;
    engine?: string;
    engine_version?: string;
  }>;
  dynamo_tables?: string[];
  ses_identities?: Array<{ name?: string; type?: string; verified?: boolean }>;
  ses_configuration_sets?: string[];
  waf_web_acls?: Array<{ name?: string; scope?: string }>;
  acm_certificates?: Array<{
    domain?: string;
    status?: string;
    in_use?: boolean;
  }>;
  event_buses?: Array<{ name?: string }>;
  sns_topics?: string[];
  sqs_queues?: string[];
  cognito_user_pools?: Array<{ id?: string; name?: string }>;
  errors?: Array<{ source: string; message: string }>;
};

export function BlueprintInventory({
  snapshot,
  observedAt,
}: {
  snapshot: DiscoverySnapshot | null;
  observedAt: string | null;
}) {
  if (!snapshot) {
    return (
      <div className="project-empty">
        <p>
          No inventory yet. The first AWS scan happens when StackLense
          successfully assumes the read-only role into your account. Once a
          blueprint has been generated at least once, the raw observed
          resources show up here.
        </p>
      </div>
    );
  }

  const sections: Array<{ label: string; rows: string[] }> = [
    {
      label: "ECR repositories",
      rows: (snapshot.ecr_repos ?? []).map(
        (r) => `${r.name}${r.uri ? `  —  ${r.uri}` : ""}`
      ),
    },
    {
      label: "ECS clusters & services",
      rows: (snapshot.ecs_clusters ?? []).flatMap((cl) => {
        const out = [`${cl.name} (cluster)`];
        for (const svc of cl.services ?? []) {
          out.push(
            `  └ ${svc.name}  ${svc.launch_type ?? ""}` +
              (svc.running_count !== undefined
                ? `  ${svc.running_count}/${svc.desired_count} running`
                : "")
          );
          for (const img of svc.container_images ?? []) {
            out.push(`     image: ${img}`);
          }
        }
        return out;
      }),
    },
    {
      label: "S3 buckets",
      rows: (snapshot.s3_buckets ?? []).map(
        (b) => `${b.name}${b.region ? `  (${b.region})` : ""}`
      ),
    },
    {
      label: "RDS",
      rows: [
        ...(snapshot.rds_instances ?? []).map(
          (i) => `instance: ${i.id}  ${i.engine} ${i.engine_version}`
        ),
        ...(snapshot.rds_clusters ?? []).map(
          (c) => `cluster: ${c.id}  ${c.engine} ${c.engine_version}`
        ),
      ],
    },
    {
      label: "DynamoDB tables",
      rows: snapshot.dynamo_tables ?? [],
    },
    {
      label: "Lambda functions",
      rows: (snapshot.lambda_functions ?? []).map(
        (f) => `${f.name}  (${f.runtime ?? "?"})`
      ),
    },
    {
      label: "Load balancers",
      rows: (snapshot.load_balancers ?? []).map(
        (lb) =>
          `${lb.name}  ${lb.type}  ${lb.scheme}` +
          (lb.dns ? `  →  ${lb.dns}` : "")
      ),
    },
    {
      label: "CloudFront",
      rows: (snapshot.cloudfront_distributions ?? []).map(
        (d) =>
          `${d.domain}` +
          (d.aliases && d.aliases.length > 0
            ? `  →  ${d.aliases.join(", ")}`
            : "")
      ),
    },
    {
      label: "Route 53 hosted zones",
      rows: (snapshot.hosted_zones ?? []).map(
        (z) =>
          `${z.name}  (${z.private ? "private" : "public"}, ${
            z.record_count ?? 0
          } records)`
      ),
    },
    {
      label: "ACM certificates",
      rows: (snapshot.acm_certificates ?? []).map(
        (c) =>
          `${c.domain}  ${c.status}${c.in_use ? "  (in use)" : ""}`
      ),
    },
    {
      label: "WAF web ACLs",
      rows: (snapshot.waf_web_acls ?? []).map(
        (a) => `${a.name}  ${a.scope}`
      ),
    },
    {
      label: "SES (transactional email)",
      rows: [
        ...(snapshot.ses_identities ?? []).map(
          (i) =>
            `${i.name}  ${i.type}${i.verified ? "  (verified)" : ""}`
        ),
        ...(snapshot.ses_configuration_sets ?? []).map(
          (cs) => `config set: ${cs}`
        ),
      ],
    },
    {
      label: "EventBridge buses",
      rows: (snapshot.event_buses ?? []).map((b) => b.name ?? ""),
    },
    {
      label: "SNS topics",
      rows: snapshot.sns_topics ?? [],
    },
    {
      label: "SQS queues",
      rows: snapshot.sqs_queues ?? [],
    },
    {
      label: "Cognito user pools",
      rows: (snapshot.cognito_user_pools ?? []).map(
        (p) => `${p.name}  (${p.id})`
      ),
    },
    {
      label: "Secrets Manager (names only)",
      rows: (snapshot.secrets ?? []).map(
        (s) => `${s.name}${s.description ? `  —  ${s.description}` : ""}`
      ),
    },
    {
      label: "CloudWatch log groups",
      rows: (snapshot.log_groups ?? [])
        .slice(0, 30)
        .map(
          (g) =>
            `${g.name}${
              g.retention_days ? `  (retain ${g.retention_days}d)` : ""
            }`
        ),
    },
  ];

  const errors = snapshot.errors ?? [];

  return (
    <div className="bp-inventory">
      <p className="bp-inventory-meta">
        AWS account <code>{snapshot.account_id}</code> · region{" "}
        <code>{snapshot.region}</code>
        {observedAt && (
          <>
            {" "}· observed{" "}
            {new Date(observedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </>
        )}
      </p>

      {sections.map((s) => (
        <div key={s.label} className="bp-inv-section">
          <h4 className="bp-inv-label">{s.label}</h4>
          {s.rows.length === 0 ? (
            <p className="bp-inv-empty">none</p>
          ) : (
            <ul className="bp-inv-list">
              {s.rows.map((row, i) => (
                <li key={i} className="bp-inv-row">
                  {row}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {errors.length > 0 && (
        <div className="bp-inv-section">
          <h4 className="bp-inv-label">Discovery errors</h4>
          <ul className="bp-inv-list">
            {errors.map((e, i) => (
              <li key={i} className="bp-inv-row bp-inv-error">
                {e.source}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
