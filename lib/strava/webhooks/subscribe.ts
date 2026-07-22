import { stravaConfig } from "@/lib/strava/api/config";

export interface PushSubscription {
  id: number;
  callback_url: string;
  created_at: string;
  updated_at: string;
}

export async function createPushSubscription(
  callbackUrl: string,
  verifyToken: string,
): Promise<PushSubscription> {
  const { clientId, clientSecret } = stravaConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: callbackUrl,
    verify_token: verifyToken,
  });

  const res = await fetch("https://www.strava.com/api/v3/push_subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook subscription failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<PushSubscription>;
}

export async function listPushSubscriptions(): Promise<PushSubscription[]> {
  const { clientId, clientSecret } = stravaConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(`https://www.strava.com/api/v3/push_subscriptions?${params}`);
  if (!res.ok) return [];
  return res.json() as Promise<PushSubscription[]>;
}
