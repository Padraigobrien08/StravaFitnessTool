import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getAllFitDetailsForUser } from "@/lib/db/activity-streams";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const details = await getAllFitDetailsForUser(userId);
  return NextResponse.json(details);
}
