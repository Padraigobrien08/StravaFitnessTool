import { NextResponse } from "next/server";

/** V2 placeholder — confirms API layer is wired for future hosted imports */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: "v1-local",
    hosted: false,
    message: "StrideIQ API ready for V2 import endpoints",
  });
}
