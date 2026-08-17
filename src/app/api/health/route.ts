import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "diezmapp-api",
    timestamp: new Date().toISOString(),
  });
}