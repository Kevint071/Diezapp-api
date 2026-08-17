import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const checks = {
    api: true,
    oauth: Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.APP_REDIRECT_SCHEME,
    ),
  };
  const ready = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      service: "diezmapp-api",
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}