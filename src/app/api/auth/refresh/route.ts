import { type NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_TOKEN_ENDPOINT,
  googleClientId,
  googleClientSecret,
  isAppSecretValid,
} from "@/lib/google-oauth";

/**
 * Called directly by the Flet app (not the browser) whenever a stored
 * access_token has expired. The refresh_token grant requires client_secret,
 * so this can't happen on-device — the app posts its refresh_token here and
 * gets back a fresh access_token.
 */
export async function POST(request: NextRequest) {
  if (!isAppSecretValid(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { refresh_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const refreshToken = body.refresh_token;
  if (!refreshToken) {
    return NextResponse.json({ error: "missing_refresh_token" }, { status: 400 });
  }

  let clientId: string;
  let clientSecret: string;
  try {
    clientId = googleClientId();
    clientSecret = googleClientSecret();
  } catch {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: "refresh_failed" }, { status: 401 });
  }

  const tokens = await tokenResponse.json();
  return NextResponse.json({
    access_token: tokens.access_token,
    expires_in: tokens.expires_in ?? 3600,
  });
}
