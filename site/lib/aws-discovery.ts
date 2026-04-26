import "server-only";

import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import {
  ECRClient,
  DescribeRepositoriesCommand,
} from "@aws-sdk/client-ecr";
import {
  ECSClient,
  ListClustersCommand,
  DescribeClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
} from "@aws-sdk/client-ecs";
import {
  S3Client,
  ListBucketsCommand,
  GetBucketLocationCommand,
} from "@aws-sdk/client-s3";
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  Route53Client,
  ListHostedZonesCommand,
} from "@aws-sdk/client-route-53";
import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import {
  SecretsManagerClient,
  ListSecretsCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  LambdaClient,
  ListFunctionsCommand,
} from "@aws-sdk/client-lambda";
import {
  CloudFrontClient,
  ListDistributionsCommand,
} from "@aws-sdk/client-cloudfront";
import {
  RDSClient,
  DescribeDBInstancesCommand,
  DescribeDBClustersCommand,
} from "@aws-sdk/client-rds";
import {
  DynamoDBClient,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import {
  SESv2Client,
  ListEmailIdentitiesCommand,
  ListConfigurationSetsCommand,
} from "@aws-sdk/client-sesv2";
import {
  WAFV2Client,
  ListWebACLsCommand,
} from "@aws-sdk/client-wafv2";
import {
  ACMClient,
  ListCertificatesCommand,
} from "@aws-sdk/client-acm";
import {
  EventBridgeClient,
  ListEventBusesCommand,
} from "@aws-sdk/client-eventbridge";
import { SNSClient, ListTopicsCommand } from "@aws-sdk/client-sns";
import { SQSClient, ListQueuesCommand } from "@aws-sdk/client-sqs";
import {
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
} from "@aws-sdk/client-cognito-identity-provider";

type AwsCreds = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
};

export type AwsDiscoveryResult = {
  account_id: string;
  region: string;
  ecr_repos: Array<{ name?: string; uri?: string; created_at?: string }>;
  ecs_clusters: Array<{
    name?: string;
    arn?: string;
    services: Array<{
      name?: string;
      arn?: string;
      task_def?: string;
      launch_type?: string;
      desired_count?: number;
      running_count?: number;
      container_images?: string[];
    }>;
  }>;
  s3_buckets: Array<{ name?: string; region?: string; created?: string }>;
  log_groups: Array<{ name?: string; retention_days?: number }>;
  load_balancers: Array<{
    name?: string;
    type?: string;
    scheme?: string;
    dns?: string;
  }>;
  hosted_zones: Array<{
    name?: string;
    id?: string;
    private?: boolean;
    record_count?: number;
  }>;
  secrets: Array<{ name?: string; description?: string }>;
  lambda_functions: Array<{ name?: string; runtime?: string; arn?: string }>;
  cloudfront_distributions: Array<{
    id?: string;
    domain?: string;
    aliases?: string[];
  }>;
  rds_instances: Array<{
    id?: string;
    engine?: string;
    engine_version?: string;
  }>;
  rds_clusters: Array<{
    id?: string;
    engine?: string;
    engine_version?: string;
  }>;
  dynamo_tables: string[];
  ses_identities: Array<{
    name?: string;
    type?: string;
    verified?: boolean;
  }>;
  ses_configuration_sets: string[];
  waf_web_acls: Array<{ name?: string; arn?: string; scope?: string }>;
  acm_certificates: Array<{
    domain?: string;
    status?: string;
    in_use?: boolean;
  }>;
  event_buses: Array<{ name?: string; arn?: string }>;
  sns_topics: string[];
  sqs_queues: string[];
  cognito_user_pools: Array<{ id?: string; name?: string }>;
  errors: Array<{ source: string; message: string }>;
};

export type AwsDiscoveryError = { ok: false; reason: string };

const REGION = process.env.STACKLENSE_AWS_REGION || "us-east-1";

/**
 * Assume the customer's read-only role and enumerate their AWS resources.
 * The role ARN is constructed deterministically from the account ID and
 * the WebhookToken (which doubles as the ExternalId in the CFN template).
 */
export async function discoverAwsResources(args: {
  accountId: string;
  externalId: string; // WebhookToken; doubles as STS ExternalId
}): Promise<AwsDiscoveryResult | AwsDiscoveryError> {
  const accessKeyId = process.env.STACKLENSE_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STACKLENSE_AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    return { ok: false, reason: "no-stacklense-aws-creds" };
  }

  const roleArn = `arn:aws:iam::${args.accountId}:role/StackLense-ReadOnly-${args.accountId}`;
  const sts = new STSClient({
    region: REGION,
    credentials: { accessKeyId, secretAccessKey },
  });

  let creds: AwsCreds;
  try {
    const assumed = await sts.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `stacklense-discovery-${Date.now()}`,
        ExternalId: args.externalId,
        DurationSeconds: 900,
      })
    );
    if (!assumed.Credentials) {
      return { ok: false, reason: "assume-role-no-credentials" };
    }
    creds = {
      accessKeyId: assumed.Credentials.AccessKeyId!,
      secretAccessKey: assumed.Credentials.SecretAccessKey!,
      sessionToken: assumed.Credentials.SessionToken!,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `assume-role-failed: ${msg}` };
  }

  const errors: Array<{ source: string; message: string }> = [];
  const opts = { region: REGION, credentials: creds };

  const safe = async <T>(
    source: string,
    fn: () => Promise<T>
  ): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (e) {
      errors.push({
        source,
        message: e instanceof Error ? e.message : String(e),
      });
      return undefined;
    }
  };

  const [
    ecrRepos,
    ecsData,
    s3Buckets,
    logGroups,
    loadBalancers,
    hostedZones,
    secrets,
    lambdaFns,
    cloudfront,
    rdsInstances,
    rdsClusters,
    dynamoTables,
    sesIdentities,
    sesConfigSets,
    wafAcls,
    acmCerts,
    eventBuses,
    snsTopics,
    sqsQueues,
    cognitoPools,
  ] = await Promise.all([
    safe("ecr", () => listEcrRepos(opts)),
    safe("ecs", () => listEcsClustersAndServices(opts)),
    safe("s3", () => listS3Buckets(opts)),
    safe("logs", () => listLogGroups(opts)),
    safe("elb", () => listLoadBalancers(opts)),
    safe("route53", () => listHostedZones(opts)),
    safe("secrets", () => listSecrets(opts)),
    safe("lambda", () => listLambdaFunctions(opts)),
    safe("cloudfront", () => listCloudFront(opts)),
    safe("rds-instances", () => listRdsInstances(opts)),
    safe("rds-clusters", () => listRdsClusters(opts)),
    safe("dynamodb", () => listDynamoTables(opts)),
    safe("ses-identities", () => listSesIdentities(opts)),
    safe("ses-config-sets", () => listSesConfigurationSets(opts)),
    safe("waf", () => listWafAcls(opts)),
    safe("acm", () => listAcmCerts(opts)),
    safe("event-buses", () => listEventBuses(opts)),
    safe("sns", () => listSnsTopics(opts)),
    safe("sqs", () => listSqsQueues(opts)),
    safe("cognito", () => listCognitoUserPools(opts)),
  ]);

  return {
    account_id: args.accountId,
    region: REGION,
    ecr_repos: ecrRepos ?? [],
    ecs_clusters: ecsData ?? [],
    s3_buckets: s3Buckets ?? [],
    log_groups: logGroups ?? [],
    load_balancers: loadBalancers ?? [],
    hosted_zones: hostedZones ?? [],
    secrets: secrets ?? [],
    lambda_functions: lambdaFns ?? [],
    cloudfront_distributions: cloudfront ?? [],
    rds_instances: rdsInstances ?? [],
    rds_clusters: rdsClusters ?? [],
    dynamo_tables: dynamoTables ?? [],
    ses_identities: sesIdentities ?? [],
    ses_configuration_sets: sesConfigSets ?? [],
    waf_web_acls: wafAcls ?? [],
    acm_certificates: acmCerts ?? [],
    event_buses: eventBuses ?? [],
    sns_topics: snsTopics ?? [],
    sqs_queues: sqsQueues ?? [],
    cognito_user_pools: cognitoPools ?? [],
    errors,
  };
}

// ----------------------------------------------------------------------------
// Per-service enumeration
// ----------------------------------------------------------------------------

async function listEcrRepos(opts: { region: string; credentials: AwsCreds }) {
  const c = new ECRClient(opts);
  const r = await c.send(new DescribeRepositoriesCommand({}));
  return (r.repositories ?? []).map((x) => ({
    name: x.repositoryName,
    uri: x.repositoryUri,
    created_at: x.createdAt?.toISOString(),
  }));
}

async function listEcsClustersAndServices(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  const c = new ECSClient(opts);
  const clustersList = await c.send(new ListClustersCommand({}));
  const arns = clustersList.clusterArns ?? [];
  if (arns.length === 0) return [];
  const described = await c.send(
    new DescribeClustersCommand({ clusters: arns })
  );

  const out: AwsDiscoveryResult["ecs_clusters"] = [];
  for (const cluster of described.clusters ?? []) {
    const clusterArn = cluster.clusterArn!;
    const svcList = await c.send(
      new ListServicesCommand({ cluster: clusterArn })
    );
    const services: AwsDiscoveryResult["ecs_clusters"][0]["services"] = [];
    if (svcList.serviceArns && svcList.serviceArns.length > 0) {
      const svcDescribed = await c.send(
        new DescribeServicesCommand({
          cluster: clusterArn,
          services: svcList.serviceArns,
        })
      );
      for (const svc of svcDescribed.services ?? []) {
        const tdName = svc.taskDefinition;
        let images: string[] | undefined;
        if (tdName) {
          const td = await c
            .send(new DescribeTaskDefinitionCommand({ taskDefinition: tdName }))
            .catch(() => undefined);
          images = td?.taskDefinition?.containerDefinitions
            ?.map((cd) => cd.image)
            .filter((x): x is string => !!x);
        }
        services.push({
          name: svc.serviceName,
          arn: svc.serviceArn,
          task_def: tdName,
          launch_type: svc.launchType,
          desired_count: svc.desiredCount,
          running_count: svc.runningCount,
          container_images: images,
        });
      }
    }
    out.push({
      name: cluster.clusterName,
      arn: clusterArn,
      services,
    });
  }
  return out;
}

async function listS3Buckets(opts: { region: string; credentials: AwsCreds }) {
  const c = new S3Client(opts);
  const r = await c.send(new ListBucketsCommand({}));
  const buckets = r.Buckets ?? [];
  // Best-effort region per bucket — costs N calls, cap at 30
  const out: AwsDiscoveryResult["s3_buckets"] = [];
  for (const b of buckets.slice(0, 30)) {
    let region: string | undefined;
    try {
      const loc = await c.send(
        new GetBucketLocationCommand({ Bucket: b.Name! })
      );
      region = loc.LocationConstraint || "us-east-1";
    } catch {
      region = undefined;
    }
    out.push({
      name: b.Name,
      region,
      created: b.CreationDate?.toISOString(),
    });
  }
  return out;
}

async function listLogGroups(opts: { region: string; credentials: AwsCreds }) {
  const c = new CloudWatchLogsClient(opts);
  const r = await c.send(new DescribeLogGroupsCommand({ limit: 50 }));
  return (r.logGroups ?? []).map((g) => ({
    name: g.logGroupName,
    retention_days: g.retentionInDays,
  }));
}

async function listLoadBalancers(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  const c = new ElasticLoadBalancingV2Client(opts);
  const r = await c.send(new DescribeLoadBalancersCommand({}));
  return (r.LoadBalancers ?? []).map((lb) => ({
    name: lb.LoadBalancerName,
    type: lb.Type,
    scheme: lb.Scheme,
    dns: lb.DNSName,
  }));
}

async function listHostedZones(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  const c = new Route53Client(opts);
  const r = await c.send(new ListHostedZonesCommand({}));
  return (r.HostedZones ?? []).map((z) => ({
    name: z.Name,
    id: z.Id,
    private: z.Config?.PrivateZone,
    record_count: z.ResourceRecordSetCount,
  }));
}

async function listSecrets(opts: { region: string; credentials: AwsCreds }) {
  const c = new SecretsManagerClient(opts);
  const r = await c.send(new ListSecretsCommand({ MaxResults: 50 }));
  return (r.SecretList ?? []).map((s) => ({
    name: s.Name,
    description: s.Description,
  }));
}

async function listLambdaFunctions(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  const c = new LambdaClient(opts);
  const r = await c.send(new ListFunctionsCommand({ MaxItems: 50 }));
  return (r.Functions ?? []).map((f) => ({
    name: f.FunctionName,
    runtime: f.Runtime,
    arn: f.FunctionArn,
  }));
}

async function listCloudFront(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  // CloudFront is global; need us-east-1
  const c = new CloudFrontClient({ ...opts, region: "us-east-1" });
  const r = await c.send(new ListDistributionsCommand({ MaxItems: 50 }));
  return (r.DistributionList?.Items ?? []).map((d) => ({
    id: d.Id,
    domain: d.DomainName,
    aliases: d.Aliases?.Items,
  }));
}

async function listRdsInstances(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  const c = new RDSClient(opts);
  const r = await c.send(new DescribeDBInstancesCommand({ MaxRecords: 50 }));
  return (r.DBInstances ?? []).map((db) => ({
    id: db.DBInstanceIdentifier,
    engine: db.Engine,
    engine_version: db.EngineVersion,
  }));
}

async function listRdsClusters(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  const c = new RDSClient(opts);
  const r = await c.send(new DescribeDBClustersCommand({ MaxRecords: 50 }));
  return (r.DBClusters ?? []).map((db) => ({
    id: db.DBClusterIdentifier,
    engine: db.Engine,
    engine_version: db.EngineVersion,
  }));
}

async function listDynamoTables(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  const c = new DynamoDBClient(opts);
  const r = await c.send(new ListTablesCommand({ Limit: 50 }));
  return r.TableNames ?? [];
}

async function listSesIdentities(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  const c = new SESv2Client(opts);
  const r = await c.send(new ListEmailIdentitiesCommand({ PageSize: 100 }));
  return (r.EmailIdentities ?? []).map((i) => ({
    name: i.IdentityName,
    type: i.IdentityType,
    verified: i.SendingEnabled,
  }));
}

async function listSesConfigurationSets(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  const c = new SESv2Client(opts);
  const r = await c.send(new ListConfigurationSetsCommand({ PageSize: 50 }));
  return r.ConfigurationSets ?? [];
}

async function listWafAcls(opts: { region: string; credentials: AwsCreds }) {
  const c = new WAFV2Client(opts);
  // Regional WAF (ALB/API Gateway). CloudFront uses CLOUDFRONT scope which
  // requires us-east-1; we stick to REGIONAL for the configured region.
  const r = await c.send(
    new ListWebACLsCommand({ Scope: "REGIONAL", Limit: 50 })
  );
  return (r.WebACLs ?? []).map((a) => ({
    name: a.Name,
    arn: a.ARN,
    scope: "REGIONAL",
  }));
}

async function listAcmCerts(opts: { region: string; credentials: AwsCreds }) {
  const c = new ACMClient(opts);
  const r = await c.send(new ListCertificatesCommand({ MaxItems: 50 }));
  return (r.CertificateSummaryList ?? []).map((cert) => ({
    domain: cert.DomainName,
    status: cert.Status,
    in_use: cert.InUse,
  }));
}

async function listEventBuses(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  const c = new EventBridgeClient(opts);
  const r = await c.send(new ListEventBusesCommand({ Limit: 50 }));
  return (r.EventBuses ?? []).map((b) => ({
    name: b.Name,
    arn: b.Arn,
  }));
}

async function listSnsTopics(opts: { region: string; credentials: AwsCreds }) {
  const c = new SNSClient(opts);
  const r = await c.send(new ListTopicsCommand({}));
  return (r.Topics ?? [])
    .map((t) => t.TopicArn)
    .filter((x): x is string => !!x);
}

async function listSqsQueues(opts: { region: string; credentials: AwsCreds }) {
  const c = new SQSClient(opts);
  const r = await c.send(new ListQueuesCommand({ MaxResults: 50 }));
  return r.QueueUrls ?? [];
}

async function listCognitoUserPools(opts: {
  region: string;
  credentials: AwsCreds;
}) {
  const c = new CognitoIdentityProviderClient(opts);
  const r = await c.send(new ListUserPoolsCommand({ MaxResults: 50 }));
  return (r.UserPools ?? []).map((p) => ({
    id: p.Id,
    name: p.Name,
  }));
}

/**
 * Pretty-print a discovery result as a markdown-like block to feed to the
 * analysis engine prompt. Empty sections are omitted to keep prompt tight.
 */
export function discoveryToPromptText(d: AwsDiscoveryResult): string {
  const lines: string[] = [];
  lines.push(`# AWS account ${d.account_id} (${d.region})`);
  lines.push("");

  if (d.ecr_repos.length > 0) {
    lines.push("## ECR repositories");
    for (const r of d.ecr_repos) {
      lines.push(`- ${r.name} (uri: ${r.uri ?? "?"})`);
    }
    lines.push("");
  }

  if (d.ecs_clusters.length > 0) {
    lines.push("## ECS");
    for (const cl of d.ecs_clusters) {
      lines.push(`- Cluster: ${cl.name}`);
      for (const s of cl.services) {
        lines.push(
          `  - Service ${s.name} (launch=${s.launch_type ?? "?"}, ` +
            `running=${s.running_count}/${s.desired_count})`
        );
        if (s.container_images && s.container_images.length > 0) {
          lines.push(`    images: ${s.container_images.join(", ")}`);
        }
      }
    }
    lines.push("");
  }

  if (d.s3_buckets.length > 0) {
    lines.push("## S3 buckets");
    for (const b of d.s3_buckets) {
      lines.push(`- ${b.name} (region: ${b.region ?? "?"})`);
    }
    lines.push("");
  }

  if (d.log_groups.length > 0) {
    lines.push("## CloudWatch log groups");
    for (const g of d.log_groups.slice(0, 30)) {
      lines.push(
        `- ${g.name}${
          g.retention_days ? ` (retention: ${g.retention_days}d)` : ""
        }`
      );
    }
    lines.push("");
  }

  if (d.load_balancers.length > 0) {
    lines.push("## Load balancers");
    for (const lb of d.load_balancers) {
      lines.push(
        `- ${lb.name} (${lb.type}, ${lb.scheme}, dns: ${lb.dns})`
      );
    }
    lines.push("");
  }

  if (d.hosted_zones.length > 0) {
    lines.push("## Route 53 hosted zones");
    for (const z of d.hosted_zones) {
      lines.push(
        `- ${z.name} (${z.private ? "private" : "public"}, ` +
          `${z.record_count ?? 0} records)`
      );
    }
    lines.push("");
  }

  if (d.secrets.length > 0) {
    lines.push("## Secrets Manager (names only — no values)");
    for (const s of d.secrets.slice(0, 30)) {
      lines.push(`- ${s.name}${s.description ? ` — ${s.description}` : ""}`);
    }
    lines.push("");
  }

  if (d.lambda_functions.length > 0) {
    lines.push("## Lambda functions");
    for (const f of d.lambda_functions) {
      lines.push(`- ${f.name} (runtime: ${f.runtime ?? "?"})`);
    }
    lines.push("");
  }

  if (d.cloudfront_distributions.length > 0) {
    lines.push("## CloudFront distributions");
    for (const c of d.cloudfront_distributions) {
      lines.push(
        `- ${c.domain}${
          c.aliases && c.aliases.length > 0 ? ` (aliases: ${c.aliases.join(", ")})` : ""
        }`
      );
    }
    lines.push("");
  }

  if (d.rds_instances.length > 0 || d.rds_clusters.length > 0) {
    lines.push("## RDS");
    for (const i of d.rds_instances) {
      lines.push(
        `- Instance: ${i.id} (${i.engine} ${i.engine_version})`
      );
    }
    for (const c of d.rds_clusters) {
      lines.push(`- Cluster: ${c.id} (${c.engine} ${c.engine_version})`);
    }
    lines.push("");
  }

  if (d.dynamo_tables.length > 0) {
    lines.push("## DynamoDB tables");
    for (const t of d.dynamo_tables) {
      lines.push(`- ${t}`);
    }
    lines.push("");
  }

  if (d.ses_identities.length > 0 || d.ses_configuration_sets.length > 0) {
    lines.push("## Amazon SES (transactional email)");
    for (const i of d.ses_identities) {
      lines.push(
        `- ${i.name} (${i.type}${i.verified ? ", verified" : ""})`
      );
    }
    for (const cs of d.ses_configuration_sets) {
      lines.push(`- config set: ${cs}`);
    }
    lines.push("");
  }

  if (d.waf_web_acls.length > 0) {
    lines.push("## WAF Web ACLs");
    for (const a of d.waf_web_acls) {
      lines.push(`- ${a.name} (${a.scope})`);
    }
    lines.push("");
  }

  if (d.acm_certificates.length > 0) {
    lines.push("## ACM certificates (SSL/TLS)");
    for (const c of d.acm_certificates) {
      lines.push(
        `- ${c.domain} (status: ${c.status}${c.in_use ? ", in use" : ""})`
      );
    }
    lines.push("");
  }

  if (d.event_buses.length > 0) {
    lines.push("## EventBridge buses");
    for (const b of d.event_buses) {
      lines.push(`- ${b.name}`);
    }
    lines.push("");
  }

  if (d.sns_topics.length > 0) {
    lines.push("## SNS topics");
    for (const t of d.sns_topics) {
      lines.push(`- ${t}`);
    }
    lines.push("");
  }

  if (d.sqs_queues.length > 0) {
    lines.push("## SQS queues");
    for (const q of d.sqs_queues) {
      lines.push(`- ${q}`);
    }
    lines.push("");
  }

  if (d.cognito_user_pools.length > 0) {
    lines.push("## Cognito user pools");
    for (const p of d.cognito_user_pools) {
      lines.push(`- ${p.name} (${p.id})`);
    }
    lines.push("");
  }

  if (d.errors.length > 0) {
    lines.push("## Discovery errors (some sources unreachable)");
    for (const e of d.errors) {
      lines.push(`- ${e.source}: ${e.message}`);
    }
    lines.push("");
  }

  if (lines.length <= 2) {
    lines.push(
      "(No resources detected via AWS APIs. Account exists but appears empty or read-role lacks permissions.)"
    );
  }

  return lines.join("\n");
}
