import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { intelligenceContextFromRequest } from "@/lib/intelligence/auth";
import {
  handleStravaMcpAction,
  STRAVA_MCP_ACTIONS,
  type StravaMcpAction,
} from "@/lib/mcp/stravaProxy";

const ACTIONS = new Set<StravaMcpAction>(STRAVA_MCP_ACTIONS);

const QUERY_KEYS = [
  "id",
  "page",
  "per_page",
  "limit",
  "after",
  "before",
  "max_pages",
  "compact",
  "verbose",
  "include_laps",
  "format",
  "chunk",
  "downsample",
  "south",
  "west",
  "north",
  "east",
  "activity_type",
  "gender",
  "age_group",
  "following",
  "club_id",
  "start_date_local",
  "end_date_local",
  "starred",
  "route_id",
] as const;

function parseParams(req: NextRequest): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of QUERY_KEYS) {
    const v = req.nextUrl.searchParams.get(key);
    if (v != null) params[key] = v;
  }
  return params;
}

/**
 * `segment_star` writes to the athlete's Strava account, so its inputs are worth
 * pinning. The previous code did `String(body.id ?? body.segment_id ?? "")`, which
 * turns an object into `"[object Object]"` and a missing id into `""` — both then
 * travelled to the Strava proxy as if they were real segment ids.
 *
 * A numeric id may arrive as a JSON number or as a string, since MCP clients send
 * both; either is coerced to a positive integer or rejected.
 */
const segmentId = z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]);

const starBodySchema = z
  .object({
    action: z.literal("segment_star").optional(),
    id: segmentId.optional(),
    segment_id: segmentId.optional(),
    starred: z.boolean().optional(),
  })
  .refine((b) => b.id !== undefined || b.segment_id !== undefined, {
    message: "id (or segment_id) is required",
    path: ["id"],
  });

function errorResponse(e: unknown) {
  const message = e instanceof Error ? e.message : "Strava API error";
  const status = message.includes("No Strava connection")
    ? 403
    : message.includes("rate limit")
      ? 429
      : 502;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action") as StravaMcpAction | null;
  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json(
      {
        error: "Invalid or missing action",
        allowed: [...STRAVA_MCP_ACTIONS],
      },
      { status: 400 },
    );
  }

  if (action === "segment_star") {
    return NextResponse.json({ error: "Use POST for segment_star" }, { status: 405 });
  }

  try {
    const data = await handleStravaMcpAction(ctx.userId, action, parseParams(req));
    return NextResponse.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = ((raw as Record<string, unknown> | null)?.action ??
    req.nextUrl.searchParams.get("action")) as StravaMcpAction | null;

  if (action !== "segment_star") {
    return NextResponse.json(
      { error: "POST supports action=segment_star only", allowed: ["segment_star"] },
      { status: 400 },
    );
  }

  const parsed = starBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const params: Record<string, string> = {
    id: String(parsed.data.id ?? parsed.data.segment_id),
    starred: String(parsed.data.starred ?? true),
  };

  try {
    const data = await handleStravaMcpAction(ctx.userId, action, params);
    return NextResponse.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
