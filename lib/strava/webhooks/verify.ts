import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify a Strava webhook event POST.
 *
 * Strava signs event deliveries with an `X-Strava-Signature` header of the form
 * `t=<unix seconds>,v1=<hex hmac>`, where the HMAC is SHA-256 over
 * `` `${t}.${rawBody}` `` keyed with the app's webhook signing secret. See
 * Strava's own reference implementation:
 * https://developers.strava.com/docs/webhookexample/
 *
 * This previously looked for `x-hub-signature-256` — a GitHub/Meta convention —
 * and HMAC'd the raw body alone with the OAuth *client* secret. Strava sends no
 * such header, so verification failed on every genuine delivery and the endpoint
 * answered 403 to all of them: push sync could never have worked.
 *
 * Because the timestamp is inside the signed payload, checking its age also gives
 * replay protection — a captured delivery cannot be usefully re-sent later.
 */

/** Reject deliveries whose signed timestamp is older than this (Strava's example uses 300s). */
export const SIGNATURE_MAX_AGE_SEC = 300;

/** A SHA-256 hex digest: exactly 64 hex characters. */
const HEX_DIGEST = /^[0-9a-f]{64}$/i;

export type WebhookVerificationReason =
  | "no_signing_secret"
  | "missing_header"
  | "malformed_header"
  | "stale_timestamp"
  | "signature_mismatch";

export interface WebhookVerification {
  valid: boolean;
  /** Why it failed — logged by the route so a misconfiguration is diagnosable. */
  reason?: WebhookVerificationReason;
}

function signingSecret(): string | undefined {
  return process.env.STRAVA_WEBHOOK_SIGNING_SECRET?.trim() || undefined;
}

/**
 * Verify the signature, reporting why it failed.
 *
 * Fails closed when no signing secret is configured, rather than trusting
 * unsigned input: the handler's delete branch removes an athlete's activity, so
 * accepting a spoofed event would be destructive, not merely noisy.
 */
export function verifyWebhookSignatureDetailed(
  rawBody: string,
  signatureHeader: string | null,
  now: Date = new Date(),
): WebhookVerification {
  const secret = signingSecret();
  if (!secret) return { valid: false, reason: "no_signing_secret" };
  if (!signatureHeader) return { valid: false, reason: "missing_header" };

  const parts = new Map(
    signatureHeader
      .split(",")
      .map((p) => p.trim().split("=", 2))
      .filter((kv): kv is [string, string] => kv.length === 2)
      .map(([k, v]) => [k.trim().toLowerCase(), v.trim()] as [string, string]),
  );

  const timestamp = parts.get("t");
  const received = parts.get("v1");
  if (!timestamp || !received || !/^\d+$/.test(timestamp)) {
    return { valid: false, reason: "malformed_header" };
  }
  // Check the hex shape explicitly: Buffer.from(x, "hex") truncates silently on
  // invalid input, so a malformed signature would otherwise compare as a short buffer.
  if (!HEX_DIGEST.test(received)) return { valid: false, reason: "malformed_header" };

  const ageSec = Math.abs(now.getTime() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > SIGNATURE_MAX_AGE_SEC) {
    return { valid: false, reason: "stale_timestamp" };
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "signature_mismatch" };
  }
  return { valid: true };
}

/** Boolean form for callers that do not need the reason. */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  now: Date = new Date(),
): boolean {
  return verifyWebhookSignatureDetailed(rawBody, signatureHeader, now).valid;
}

/** Build the header Strava would send. Used by tests, and for replaying a delivery locally. */
export function signWebhookPayload(rawBody: string, secret: string, timestampSec: number): string {
  const v1 = createHmac("sha256", secret).update(`${timestampSec}.${rawBody}`).digest("hex");
  return `t=${timestampSec},v1=${v1}`;
}
