/**
 * Why the Coach composer is inert, phrased for where the reader actually is.
 *
 * The demo notice used to tell every reader to "add OPENAI_API_KEY (or ANTHROPIC_API_KEY)
 * + DATABASE_URL to .env.local". That is actionable on a laptop and meaningless on the
 * public demo, where the reader has no `.env.local` to edit and no server to restart. An
 * instruction the reader cannot follow is worse than no instruction: it reads as the
 * product blaming them for a limit the deployment chose.
 *
 * The split is on hostname rather than on an env flag because it has to be right in a
 * static client bundle — `NEXT_PUBLIC_*` is baked at build time, and the same build is
 * what a visitor runs locally after cloning.
 */

export type CoachHost = "local" | "hosted";

/** Loopback names only. Everything else — LAN IPs included — is somebody else's server. */
export function coachHostFromHostname(hostname: string): CoachHost {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]"
    ? "local"
    : "hosted";
}

export interface ChatDisabledReasonInput {
  /** The sample athlete is loaded, so the deterministic workspace has data to show. */
  isDemo: boolean;
  /** A Strava-connected server session exists. */
  apiConnected: boolean;
  /** Whether this bundle is being served from loopback or from a deployment. */
  host: CoachHost;
}

/**
 * The demo wording deliberately leads with what *does* work. Everything on the page
 * except the composer is computed by the engines from the sample athlete, and a reader
 * who assumes the whole surface is dead will not scroll.
 */
export function chatDisabledReason({
  isDemo,
  apiConnected,
  host,
}: ChatDisabledReasonInput): string {
  if (isDemo) {
    const base =
      "Demo mode: everything on this page is computed from the sample athlete by the deterministic engines. Only the chat box is off, because tool-backed chat needs an LLM key and a synced account.";
    return host === "hosted"
      ? `${base} Run StrideIQ locally with your own key to use it. See the README “Coach chat” section.`
      : `${base} Add OPENAI_API_KEY (or ANTHROPIC_API_KEY) + DATABASE_URL to .env.local and connect Strava. See the README “Coach chat” section.`;
  }

  if (!apiConnected) {
    return "Connect Strava on Import. Coach needs server-synced activities for tool-backed reasoning.";
  }

  return "Sync activities from Import so investigations can use your full history.";
}
