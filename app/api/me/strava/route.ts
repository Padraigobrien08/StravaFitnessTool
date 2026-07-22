import { NextRequest, NextResponse } from "next/server";
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

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = (body.action ?? req.nextUrl.searchParams.get("action")) as StravaMcpAction | null;

  if (action !== "segment_star") {
    return NextResponse.json(
      { error: "POST supports action=segment_star only", allowed: ["segment_star"] },
      { status: 400 },
    );
  }

  const params: Record<string, string> = {
    id: String(body.id ?? body.segment_id ?? ""),
    starred: String(body.starred ?? "true"),
  };

  try {
    const data = await handleStravaMcpAction(ctx.userId, action, params);
    return NextResponse.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
