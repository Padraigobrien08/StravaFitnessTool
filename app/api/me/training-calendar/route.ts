import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/session";
import { deleteSavedWeek, getSavedWeeks, upsertSavedWeek } from "@/lib/db/training-calendar";

// The saved week is a client-owned object; validate the identity/shape fields
// we key and render on, and pass the rest through into JSONB.
const weekSchema = z
  .object({
    id: z.string().min(1),
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weekEnd: z.string().min(1),
    workouts: z.array(z.object({}).passthrough()).max(21),
    revision: z.number().int().positive().optional(),
  })
  .passthrough();

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const weeks = await getSavedWeeks(userId);
  return NextResponse.json({ weeks });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = z.object({ week: weekSchema }).safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    // Validated at the boundary above (weekSchema); persisted verbatim as a
    // JSONB blob — no cast needed (upsertSavedWeek accepts a PersistableWeek).
    await upsertSavedWeek(userId, parsed.data.week);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save week" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const weekStart = req.nextUrl.searchParams.get("weekStart");
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json(
      { error: "weekStart query param required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }
  try {
    await deleteSavedWeek(userId, weekStart);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete week" },
      { status: 500 },
    );
  }
}
