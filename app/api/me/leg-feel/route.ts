import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/session";
import { getLegFeel, upsertLegFeel } from "@/lib/db/leg-feel";
import { feelDateKey, type LegFeelReport } from "@/lib/wellness/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const reportSchema = z.object({
  legs: z.enum(["fresh", "normal", "heavy"]),
  niggle: z
    .object({
      area: z.string().max(60),
      severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    })
    .nullable()
    .optional(),
  note: z.string().max(280).optional(),
  source: z.enum(["morning", "post_run"]),
  reportedAt: z.string(),
});

const bodySchema = z.object({
  date: z.string().regex(DATE_RE).optional(),
  report: reportSchema,
});

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date") ?? feelDateKey();
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const report = await getLegFeel(userId, date);
  return NextResponse.json({ date, report });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const date = parsed.data.date ?? feelDateKey();
  try {
    await upsertLegFeel(userId, date, parsed.data.report as LegFeelReport);
    return NextResponse.json({ date, report: parsed.data.report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save leg feel" },
      { status: 500 },
    );
  }
}
