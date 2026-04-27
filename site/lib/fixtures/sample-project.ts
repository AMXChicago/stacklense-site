/**
 * Static fixture used by spec build step 1 (and any later step that
 * wants a known-good Project to render against without hitting the
 * backend). Matches the spec's "9 services / 8 connections"
 * baseline.
 *
 * Shape: a typical web-app architecture.
 *
 *   User ──► AWS:Lambda ──► AWS:RDS Postgres
 *                       │
 *                       ├─► AWS:S3
 *                       ├─► AWS:Cognito
 *                       ├─► AWS:SES        (async)
 *                       ├─► Stripe         (sync — charges)
 *                       │   ◄──Stripe      (webhook — events)
 *                       └─► Anthropic API  (sync — AI calls)
 *
 * Top-level (rootServiceIds): User, AWS, Stripe, Anthropic API.
 * Inside AWS: Lambda, RDS Postgres, S3, Cognito, SES.
 *
 * Two services have `lastChangedAt` set within the past 7 days so
 * the change indicator (orange dot, top-left of node) is exercised.
 *
 * `status` is "unknown" everywhere — live status indicators are
 * wired up in spec build step 11.
 *
 * `metrics` is empty everywhere — Metric Providers are wired up in
 * spec build steps 11+.
 */

import type { Project } from "@/lib/types";

const NOW = new Date().toISOString();
const ONE_DAY_AGO = new Date(Date.now() - 1 * 86_400_000).toISOString();
const THREE_DAYS_AGO = new Date(Date.now() - 3 * 86_400_000).toISOString();

export const SAMPLE_PROJECT: Project = {
  id: "sample-project",
  name: "Sample Web App",
  rootServiceIds: ["user", "aws", "stripe", "anthropic"],
  services: {
    // ── Top-level services ────────────────────────────────────────
    user: {
      id: "user",
      name: "User",
      kind: "service",
      parentId: null,
      description: "End-user browsers and mobile clients.",
      status: "unknown",
      metadata: {},
      metrics: [],
      createdAt: NOW,
    },
    aws: {
      id: "aws",
      name: "AWS",
      kind: "platform",
      parentId: null,
      description: "Compute, data, and supporting infrastructure.",
      status: "unknown",
      metadata: { brandColor: "#ff9900" },
      metrics: [],
      createdAt: NOW,
    },
    stripe: {
      id: "stripe",
      name: "Stripe",
      kind: "platform",
      parentId: null,
      description: "Payment processing.",
      status: "unknown",
      metadata: { brandColor: "#635bff" },
      metrics: [],
      lastChangedAt: ONE_DAY_AGO,
      createdAt: NOW,
    },
    anthropic: {
      id: "anthropic",
      name: "Anthropic API",
      kind: "platform",
      parentId: null,
      description: "Claude AI calls.",
      status: "unknown",
      metadata: { brandColor: "#d97757" },
      metrics: [],
      createdAt: NOW,
    },

    // ── Children of AWS ───────────────────────────────────────────
    lambda: {
      id: "lambda",
      name: "Lambda",
      kind: "service",
      parentId: "aws",
      description: "Serverless function hosting.",
      status: "unknown",
      metadata: {},
      metrics: [],
      lastChangedAt: THREE_DAYS_AGO,
      createdAt: NOW,
    },
    postgres: {
      id: "postgres",
      name: "RDS Postgres",
      kind: "service",
      parentId: "aws",
      description: "Primary application database.",
      status: "unknown",
      metadata: {},
      metrics: [],
      createdAt: NOW,
    },
    s3: {
      id: "s3",
      name: "S3",
      kind: "service",
      parentId: "aws",
      description: "Object storage for user uploads.",
      status: "unknown",
      metadata: {},
      metrics: [],
      createdAt: NOW,
    },
    cognito: {
      id: "cognito",
      name: "Cognito",
      kind: "service",
      parentId: "aws",
      description: "User identity and authentication.",
      status: "unknown",
      metadata: {},
      metrics: [],
      createdAt: NOW,
    },
    ses: {
      id: "ses",
      name: "SES",
      kind: "service",
      parentId: "aws",
      description: "Transactional email.",
      status: "unknown",
      metadata: {},
      metrics: [],
      createdAt: NOW,
    },
  },
  connections: {
    "user-lambda": {
      id: "user-lambda",
      fromServiceId: "user",
      toServiceId: "lambda",
      type: "sync",
      what: "HTTP API requests.",
      createdAt: NOW,
    },
    "lambda-postgres": {
      id: "lambda-postgres",
      fromServiceId: "lambda",
      toServiceId: "postgres",
      type: "sync",
      what: "Reads and writes application data.",
      createdAt: NOW,
    },
    "lambda-s3": {
      id: "lambda-s3",
      fromServiceId: "lambda",
      toServiceId: "s3",
      type: "sync",
      what: "Stores user uploads.",
      createdAt: NOW,
    },
    "lambda-cognito": {
      id: "lambda-cognito",
      fromServiceId: "lambda",
      toServiceId: "cognito",
      type: "sync",
      what: "Verifies access tokens.",
      createdAt: NOW,
    },
    "lambda-ses": {
      id: "lambda-ses",
      fromServiceId: "lambda",
      toServiceId: "ses",
      type: "async",
      what: "Sends transactional email.",
      createdAt: NOW,
    },
    "lambda-stripe": {
      id: "lambda-stripe",
      fromServiceId: "lambda",
      toServiceId: "stripe",
      type: "sync",
      what: "Creates charges.",
      createdAt: NOW,
    },
    "stripe-lambda": {
      id: "stripe-lambda",
      fromServiceId: "stripe",
      toServiceId: "lambda",
      type: "webhook",
      what: "Payment lifecycle events.",
      createdAt: NOW,
    },
    "lambda-anthropic": {
      id: "lambda-anthropic",
      fromServiceId: "lambda",
      toServiceId: "anthropic",
      type: "sync",
      what: "AI API calls.",
      createdAt: NOW,
    },
  },
  activity: [],
};
