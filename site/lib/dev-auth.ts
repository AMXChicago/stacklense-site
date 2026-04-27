import "server-only";

/**
 * Dev-only auth bypass. When NEXT_PUBLIC_DEV_BYPASS_AUTH=true is set
 * in `.env.local`, the /dashboard auth gate (both middleware-level
 * and layout-level) is short-circuited so the canvas can be loaded
 * locally without a real Supabase session.
 *
 * The NODE_ENV check is mandatory: the bypass cannot be enabled in
 * production builds even if the env var leaks. Both conditions must
 * hold.
 *
 * This exists because every step of the spec build needs to navigate
 * /dashboard/[id] to verify rendering, and getting a real session
 * cookie wired up locally is friction that a one-line env flag
 * removes.
 */
export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true"
  );
}
