import { createHmac, timingSafeEqual } from "crypto";
import { stravaConfig } from "@/lib/strava/api/config";

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const { clientSecret } = stravaConfig();
  const expected = createHmac("sha256", clientSecret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
