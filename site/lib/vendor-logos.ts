/**
 * Vendor logo resolution. Maps a vendor name to a domain we can fetch
 * a logo for, then builds a URL via DuckDuckGo's free favicon service.
 *
 * Why DuckDuckGo: Clearbit's Logo API (which we used to use) was
 * discontinued — `logo.clearbit.com` no longer resolves. DDG's
 * `icons.duckduckgo.com/ip3/{domain}.ico` endpoint is free, requires
 * no auth, returns the company's actual favicon at decent resolution,
 * and reliably works for every brand we tested (AWS, OpenAI,
 * Node.js, GitHub, Vercel, Stripe, Supabase, Resend, Cloudflare,
 * Postgres, etc.).
 *
 * Match is case-insensitive and tolerant of variations ("AWS"
 * matches "Amazon Web Services" matches "amazon"). Unknown vendors
 * return null so the caller can render a fallback letter avatar.
 */
const VENDOR_TO_DOMAIN: Array<[RegExp, string]> = [
  // Cloud / hosting
  [/^vercel/i, "vercel.com"],
  [/^netlify/i, "netlify.com"],
  [/^cloudflare/i, "cloudflare.com"],
  [/^railway/i, "railway.app"],
  [/^render/i, "render.com"],
  [/^fly\.io|^fly\b/i, "fly.io"],
  [/^heroku/i, "heroku.com"],
  [/^digitalocean|^digital ocean/i, "digitalocean.com"],
  [/amazon|^aws\b/i, "aws.amazon.com"],
  [/^google cloud|^gcp\b/i, "cloud.google.com"],
  [/^azure|^microsoft azure/i, "azure.microsoft.com"],

  // Source / dev
  [/^github/i, "github.com"],
  [/^gitlab/i, "gitlab.com"],
  [/^bitbucket/i, "bitbucket.org"],

  // Data / databases
  [/^supabase/i, "supabase.com"],
  [/^firebase/i, "firebase.google.com"],
  [/^planetscale/i, "planetscale.com"],
  [/^neon/i, "neon.tech"],
  [/^mongodb/i, "mongodb.com"],
  [/^upstash/i, "upstash.com"],
  [/^redis/i, "redis.io"],
  [/^postgresql|^postgres\b/i, "postgresql.org"],

  // Auth
  [/^auth0/i, "auth0.com"],
  [/^clerk/i, "clerk.com"],
  [/^okta/i, "okta.com"],
  [/^stytch/i, "stytch.com"],
  [/^workos/i, "workos.com"],

  // Email / comms
  [/^resend/i, "resend.com"],
  [/^sendgrid/i, "sendgrid.com"],
  [/^postmark/i, "postmarkapp.com"],
  [/^mailgun/i, "mailgun.com"],
  [/^twilio/i, "twilio.com"],
  [/^slack/i, "slack.com"],
  [/^discord/i, "discord.com"],
  [/^pusher/i, "pusher.com"],

  // Domains / DNS
  [/^godaddy/i, "godaddy.com"],
  [/^namecheap/i, "namecheap.com"],
  [/^name\.com/i, "name.com"],
  [/^porkbun/i, "porkbun.com"],
  [/route\s*53/i, "aws.amazon.com"],

  // Payments
  [/^stripe/i, "stripe.com"],
  [/^paddle/i, "paddle.com"],
  [/^lemon\s*squeezy/i, "lemonsqueezy.com"],
  [/^paypal/i, "paypal.com"],
  [/^braintree/i, "braintreepayments.com"],
  [/^square/i, "squareup.com"],

  // Observability / analytics
  [/^sentry/i, "sentry.io"],
  [/^posthog/i, "posthog.com"],
  [/^datadog/i, "datadoghq.com"],
  [/^new\s*relic/i, "newrelic.com"],
  [/^logrocket/i, "logrocket.com"],
  [/^mixpanel/i, "mixpanel.com"],
  [/^amplitude/i, "amplitude.com"],
  [/^google analytics/i, "google.com"],
  [/^plausible/i, "plausible.io"],
  [/^fathom/i, "usefathom.com"],

  // AI / dev tools
  [/^anthropic|^claude code|^claude\b/i, "anthropic.com"],
  [/^openai|^codex|^chatgpt/i, "openai.com"],
  [/^cursor/i, "cursor.com"],
  [/^windsurf/i, "windsurf.com"],
  [/^github copilot/i, "github.com"],
  [/^replit/i, "replit.com"],

  // CI/CD
  [/^github actions/i, "github.com"],
  [/^circleci|^circle ci/i, "circleci.com"],
  [/^travis ci/i, "travis-ci.com"],
  [/^gitlab ci/i, "gitlab.com"],

  // Frameworks / runtimes (less likely to be "vendors" but useful)
  [/^next\.?js/i, "nextjs.org"],
  [/^react/i, "react.dev"],
  [/^node\.?js|^node\b/i, "nodejs.org"],
  [/^docker/i, "docker.com"],
  [/^typescript/i, "typescriptlang.org"],
];

export function vendorLogoUrl(name: string | undefined | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  for (const [pattern, domain] of VENDOR_TO_DOMAIN) {
    if (pattern.test(trimmed)) {
      // Google's S2 favicon service. Free, no API key. The `sz=128`
      // parameter requests a high-resolution version where available
      // (AWS, OpenAI, Supabase, Anthropic, Stripe etc. all publish
      // 128px favicons). Higher resolution than DuckDuckGo's IP3
      // service, which returns 16×16 for major brands like AWS and
      // GitHub — those upscale to a fuzzy blob at 44px display size.
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }
  }
  return null;
}

/**
 * First letter of the vendor name, uppercased, for the fallback avatar.
 */
export function vendorInitial(name: string | undefined | null): string {
  if (!name) return "•";
  const trimmed = name.trim();
  if (!trimmed) return "•";
  return trimmed.charAt(0).toUpperCase();
}
