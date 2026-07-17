import { NextRequest, NextResponse } from "next/server";
import { intelligenceContextFromRequest } from "@/lib/intelligence/auth";
import {
  COMPOSITE_ACTIONS,
  handleCompositeCoachAction,
  type CompositeCoachAction,
} from "@/lib/mcp/compositeCoach";

const ACTIONS = new Set<CompositeCoachAction>(COMPOSITE_ACTIONS);

export async function GET(req: NextRequest) {
  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get(
    "action"
  ) as CompositeCoachAction | null;
  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json(
      { error: "Invalid action", allowed: [...COMPOSITE_ACTIONS] },
      { status: 400 }
    );
  }

  const params: Record<string, string> = {};
  for (const key of ["downsample", "bucket"]) {
    const v = req.nextUrl.searchParams.get(key);
    if (v) params[key] = v;
  }

  try {
    const data = await handleCompositeCoachAction(ctx, action, params);
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Composite coach failed";
    const status = message.includes("No Strava connection") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
