import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_PICKER_SCOPE,
  PICKER_ACCOUNT_COOKIE,
  PICKER_STATE_COOKIE,
  PICKER_VERIFIER_COOKIE,
  PICKER_APP_STATE_COOKIE,
  googleClientId,
  oauthCookieOptions,
  pickerCallbackRedirectUri,
} from "@/lib/google-oauth";

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Starts Google's mobile/desktop Picker flow for an already linked account. */
export async function GET(request: NextRequest) {
  const appState = request.nextUrl.searchParams.get("app_state");
  const accountId = request.nextUrl.searchParams.get("account_id");
  const loginHint = request.nextUrl.searchParams.get("login_hint");
  if (!appState || !accountId) {
    return NextResponse.json({ error: "missing_picker_state" }, { status: 400 });
  }

  try {
    const state = crypto.randomUUID();
    const verifier = base64url(crypto.randomBytes(64));
    const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
    const params = new URLSearchParams({
      client_id: googleClientId(),
      redirect_uri: pickerCallbackRedirectUri(request),
      response_type: "code",
      scope: GOOGLE_PICKER_SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      access_type: "offline",
      prompt: "consent",
      trigger_onepick: "true",
      allow_folder_selection: "true",
      mimetypes: "application/vnd.google-apps.folder",
    });
    if (loginHint) params.set("login_hint", loginHint);

    const response = NextResponse.redirect(`${GOOGLE_AUTH_ENDPOINT}?${params}`);
    const options = { ...oauthCookieOptions(request), path: "/api" };
    response.cookies.set(PICKER_STATE_COOKIE, state, options);
    response.cookies.set(PICKER_VERIFIER_COOKIE, verifier, options);
    response.cookies.set(PICKER_APP_STATE_COOKIE, appState, options);
    response.cookies.set(PICKER_ACCOUNT_COOKIE, accountId, options);
    return response;
  } catch {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }
}