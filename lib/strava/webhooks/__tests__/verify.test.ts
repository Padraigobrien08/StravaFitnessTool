import { afterEach, describe, expect, it } from "vitest";
import {
  SIGNATURE_MAX_AGE_SEC,
  signWebhookPayload,
  verifyWebhookSignature,
  verifyWebhookSignatureDetailed,
} from "../verify";

const SECRET = "test-signing-secret";
const NOW = new Date("2026-08-05T12:00:00.000Z");
const NOW_SEC = Math.floor(NOW.getTime() / 1000);

/** A realistic Strava event payload. */
const BODY = JSON.stringify({
  aspect_type: "create",
  object_type: "activity",
  object_id: 1234567890,
  owner_id: 105352925,
  subscription_id: 999,
  event_time: NOW_SEC,
});

function withSecret(secret: string | undefined, fn: () => void) {
  const prev = process.env.STRAVA_WEBHOOK_SIGNING_SECRET;
  if (secret === undefined) delete process.env.STRAVA_WEBHOOK_SIGNING_SECRET;
  else process.env.STRAVA_WEBHOOK_SIGNING_SECRET = secret;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.STRAVA_WEBHOOK_SIGNING_SECRET;
    else process.env.STRAVA_WEBHOOK_SIGNING_SECRET = prev;
  }
}

afterEach(() => {
  delete process.env.STRAVA_WEBHOOK_SIGNING_SECRET;
});

describe("verifyWebhookSignature", () => {
  it("accepts a genuine Strava delivery (t=…,v1=… over `${t}.${body}`)", () => {
    withSecret(SECRET, () => {
      const header = signWebhookPayload(BODY, SECRET, NOW_SEC);
      expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
      expect(verifyWebhookSignature(BODY, header, NOW)).toBe(true);
    });
  });

  it("tolerates whitespace and reordered header parts", () => {
    withSecret(SECRET, () => {
      const v1 = signWebhookPayload(BODY, SECRET, NOW_SEC).split("v1=")[1];
      expect(verifyWebhookSignature(BODY, `v1=${v1}, t=${NOW_SEC}`, NOW)).toBe(true);
    });
  });

  // The regression that mattered: the old implementation read this header and
  // HMAC'd the body alone with the OAuth client secret, so every real delivery 403'd.
  it("rejects the GitHub-style header the old implementation expected", () => {
    withSecret(SECRET, () => {
      const r = verifyWebhookSignatureDetailed(BODY, "sha256=deadbeef", NOW);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("malformed_header");
    });
  });

  it("rejects a signature over the body without the timestamp prefix", () => {
    withSecret(SECRET, () => {
      // What the old scheme produced: HMAC(body) with no `${t}.` prefix.
      const wrong = signWebhookPayload("", SECRET, NOW_SEC); // t=…,v1=HMAC("<t>.")
      const v1 = wrong.split("v1=")[1];
      expect(verifyWebhookSignatureDetailed(BODY, `t=${NOW_SEC},v1=${v1}`, NOW).reason).toBe(
        "signature_mismatch",
      );
    });
  });

  it("fails closed when no signing secret is configured", () => {
    withSecret(undefined, () => {
      const header = signWebhookPayload(BODY, SECRET, NOW_SEC);
      const r = verifyWebhookSignatureDetailed(BODY, header, NOW);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("no_signing_secret");
    });
  });

  it("rejects a missing or empty header", () => {
    withSecret(SECRET, () => {
      expect(verifyWebhookSignatureDetailed(BODY, null, NOW).reason).toBe("missing_header");
      expect(verifyWebhookSignatureDetailed(BODY, "", NOW).reason).toBe("missing_header");
    });
  });

  it("rejects a body tampered with after signing", () => {
    withSecret(SECRET, () => {
      const header = signWebhookPayload(BODY, SECRET, NOW_SEC);
      const tampered = BODY.replace('"aspect_type":"create"', '"aspect_type":"delete"');
      expect(tampered).not.toBe(BODY);
      expect(verifyWebhookSignatureDetailed(tampered, header, NOW).reason).toBe(
        "signature_mismatch",
      );
    });
  });

  it("rejects a signature made with the wrong secret", () => {
    withSecret(SECRET, () => {
      const header = signWebhookPayload(BODY, "not-the-secret", NOW_SEC);
      expect(verifyWebhookSignatureDetailed(BODY, header, NOW).reason).toBe("signature_mismatch");
    });
  });

  // The timestamp is inside the signed payload, so age-checking it is replay protection.
  it("rejects a replayed delivery older than the tolerance", () => {
    withSecret(SECRET, () => {
      const old = NOW_SEC - (SIGNATURE_MAX_AGE_SEC + 1);
      const header = signWebhookPayload(BODY, SECRET, old);
      expect(verifyWebhookSignatureDetailed(BODY, header, NOW).reason).toBe("stale_timestamp");
    });
  });

  it("accepts a delivery just inside the tolerance", () => {
    withSecret(SECRET, () => {
      const recent = NOW_SEC - (SIGNATURE_MAX_AGE_SEC - 5);
      const header = signWebhookPayload(BODY, SECRET, recent);
      expect(verifyWebhookSignature(BODY, header, NOW)).toBe(true);
    });
  });

  it("rejects a future timestamp beyond the tolerance", () => {
    withSecret(SECRET, () => {
      const future = NOW_SEC + (SIGNATURE_MAX_AGE_SEC + 1);
      const header = signWebhookPayload(BODY, SECRET, future);
      expect(verifyWebhookSignatureDetailed(BODY, header, NOW).reason).toBe("stale_timestamp");
    });
  });

  it.each([
    ["no v1", `t=${NOW_SEC}`],
    ["no t", "v1=" + "a".repeat(64)],
    ["non-numeric t", `t=abc,v1=${"a".repeat(64)}`],
    ["short digest", `t=${NOW_SEC},v1=abc123`],
    ["non-hex digest", `t=${NOW_SEC},v1=${"z".repeat(64)}`],
    ["junk", "garbage"],
  ])("rejects a malformed header (%s)", (_label, header) => {
    withSecret(SECRET, () => {
      const r = verifyWebhookSignatureDetailed(BODY, header, NOW);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("malformed_header");
    });
  });

  it("verifies the exact raw body, so key order and spacing matter", () => {
    withSecret(SECRET, () => {
      const raw = '{"object_type":"activity","aspect_type":"create"}';
      const header = signWebhookPayload(raw, SECRET, NOW_SEC);
      expect(verifyWebhookSignature(raw, header, NOW)).toBe(true);
      // Same JSON value, different byte sequence — must not verify. This is why the
      // route signs `await request.text()` rather than a re-serialised object.
      const reordered = '{"aspect_type":"create","object_type":"activity"}';
      expect(JSON.parse(reordered)).toEqual(JSON.parse(raw));
      expect(verifyWebhookSignature(reordered, header, NOW)).toBe(false);
    });
  });
});
