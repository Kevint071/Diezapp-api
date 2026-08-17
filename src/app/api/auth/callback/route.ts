import { type NextRequest, NextResponse } from "next/server";
import {
  APP_STATE_COOKIE,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  STATE_COOKIE,
  VERIFIER_COOKIE,
  buildAppRedirectUrl,
  buildWebRedirectUrl,
  callbackRedirectUri,
  googleClientId,
  googleClientSecret,
  WEB_RETURN_URL_COOKIE,
} from "@/lib/google-oauth";

function clearOAuthCookies(response: NextResponse): void {
  for (const name of [
    STATE_COOKIE,
    VERIFIER_COOKIE,
    APP_STATE_COOKIE,
    WEB_RETURN_URL_COOKIE,
  ]) {
    response.cookies.set(name, "", { path: "/api/auth", maxAge: 0 });
  }
}

/**
 * Step 2: Google redirects here (an https:// origin, which is what makes
 * this whole approach acceptable to Google's validation rules) with either
 * `code`/`state` or `error`. We exchange the code for tokens server-side
 * (using client_secret, which never leaves this server) and hand the result
 * off to the app via its own custom-scheme deep link.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const appState = request.cookies.get(APP_STATE_COOKIE)?.value ?? "";
  const webReturnUrl = request.cookies.get(WEB_RETURN_URL_COOKIE)?.value;
  const redirect = (params: Record<string, string>) =>
    webReturnUrl
      ? buildWebRedirectUrl(webReturnUrl, params)
      : buildAppRedirectUrl(params);

  const error = searchParams.get("error");
  if (error) {
    const response = NextResponse.redirect(
      redirect({ error, app_state: appState })
    );
    clearOAuthCookies(response);
    return response;
  }

  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;

  if (!code || !returnedState || !verifier || returnedState !== expectedState) {
    const response = NextResponse.redirect(
      redirect({ error: "invalid_state", app_state: appState })
    );
    clearOAuthCookies(response);
    return response;
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: callbackRedirectUri(request),
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error(`token exchange failed: ${tokenResponse.status}`);
    }
    const tokens = await tokenResponse.json();

    const userinfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userinfoResponse.ok) {
      throw new Error(`userinfo failed: ${userinfoResponse.status}`);
    }
    const userinfo = await userinfoResponse.json();

    const response = NextResponse.redirect(
      redirect({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? "",
        expires_in: String(tokens.expires_in ?? 3600),
        email: userinfo.email ?? "",
        app_state: appState,
      })
    );
    clearOAuthCookies(response);
    return response;
  } catch {
    const response = NextResponse.redirect(
      redirect({ error: "server_error", app_state: appState })
    );
    clearOAuthCookies(response);
    return response;
  }
}
