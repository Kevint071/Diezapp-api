import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
  APP_STATE_COOKIE,
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_OAUTH_SCOPE,
  STATE_COOKIE,
  VERIFIER_COOKIE,
  callbackRedirectUri,
  googleClientId,
  oauthCookieOptions,
  validatedWebReturnUrl,
  WEB_RETURN_URL_COOKIE,
} from "@/lib/google-oauth";

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Step 1 of the proxy flow: the Flet app opens this URL in the system
 * browser, passing an `app_state` it generated itself (and will later
 * verify on the deep-link callback, so a malicious app registering the same
 * scheme can't spoof a successful login). We generate our own PKCE pair and
 * anti-CSRF `state` for the actual Google leg and stash them in short-lived
 * cookies, then redirect to Google's authorization endpoint.
 */
export async function GET(request: NextRequest) {
  const appState = request.nextUrl.searchParams.get("app_state");
  const webReturnUrl = validatedWebReturnUrl(
    request.nextUrl.searchParams.get("web_return_url"),
  );
  if (!appState) {
    return NextResponse.json({ error: "missing app_state" }, { status: 400 });
  }

  let redirectUri: string;
  let clientId: string;
  try {
    redirectUri = callbackRedirectUri(request);
    clientId = googleClientId();
  } catch {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  const googleState = crypto.randomUUID();
  const verifier = base64url(crypto.randomBytes(64));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: googleState,
    access_type: "offline",
    prompt: "select_account consent",
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
  const cookieOptions = oauthCookieOptions(request);
  response.cookies.set(STATE_COOKIE, googleState, cookieOptions);
  response.cookies.set(VERIFIER_COOKIE, verifier, cookieOptions);
  response.cookies.set(APP_STATE_COOKIE, appState, cookieOptions);
  if (webReturnUrl) {
    response.cookies.set(WEB_RETURN_URL_COOKIE, webReturnUrl, cookieOptions);
  }
  return response;
}
