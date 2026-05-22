import type { CoachingDomain } from "./types";

export function coachUrl(params?: {
  domain?: string;
  q?: string;
  investigate?: boolean;
}): string {
  const sp = new URLSearchParams();
  if (params?.domain) sp.set("domain", params.domain);
  if (params?.q) sp.set("q", params.q);
  if (params?.investigate) sp.set("investigate", "1");
  const qs = sp.toString();
  return qs ? `/coach?${qs}` : "/coach";
}

export function intelligenceUrl(): string {
  return "/intelligence";
}

export function domainCoachLink(domain: CoachingDomain, investigate = true): string {
  return coachUrl({
    domain: domain.id,
    q: domain.suggestedQuery,
    investigate: investigate ? true : undefined,
  });
}

export function signalCoachLink(question: string): string {
  return coachUrl({ q: question, investigate: true });
}
