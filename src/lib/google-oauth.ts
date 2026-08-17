/**
 * Shared helpers for the Google OAuth backend proxy (see `src/app/api/auth`).
 *
 * Why this exists: Google no longer accepts a custom-scheme (e.g.
 * `myapp://callback`) `redirect_uri` for the Authorization Code flow — the
 * authorization server now rejects it outright (`Error 400: invalid_request`).
 * This backend is the only party that ever hands Google a `redirect_uri`,
 * and it always uses this server's own `https://` origin, which Google
 * accepts. Once the code is exchanged for tokens here, the tokens are
 * handed off to the mobile app via a redirect to *our own* custom-scheme
 * deep link — a redirect Android/iOS allow because it originates from this
 * server, not from Google directly.
 */
import type { NextRequest } from "next/server";

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
export const GOOGLE_ABOUT_ENDPOINT = "https://www.googleapis.com/drive/v3/about";
export const GOOGLE_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/drive.file openid email";
export const GOOGLE_PICKER_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Cookies are scoped to /api/auth and short-lived: they only need to survive
// the round trip through Google's consent screen.
export const STATE_COOKIE = "gdrive_oauth_state";
export const VERIFIER_COOKIE = "gdrive_oauth_verifier";
export const APP_STATE_COOKIE = "gdrive_oauth_app_state";
export const PICKER_ACCOUNT_COOKIE = "gdrive_picker_account";

export function oauthCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    maxAge: 300,
    path: "/api/auth",
  };
}

export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: 300,
  path: "/api/auth",
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function googleClientId(): string {
  return requireEnv("GOOGLE_CLIENT_ID");
}

export function googleClientSecret(): string {
  return requireEnv("GOOGLE_CLIENT_SECRET");
}

/** Must exactly match the redirect_uri authorized in Google Cloud Console. */
export function callbackRedirectUri(request: NextRequest): string {
  const base = process.env.PUBLIC_APP_URL || request.nextUrl.origin;
  return `${base.replace(/\/$/, "")}/api/auth/callback`;
}

export function pickerCallbackRedirectUri(request: NextRequest): string {
  const base = process.env.PUBLIC_APP_URL || request.nextUrl.origin;
  return `${base.replace(/\/$/, "")}/api/picker/callback`;
}

/**
 * Builds the final hand-off URL back into the mobile app. `scheme`/`host`
 * must match `[tool.flet.<platform>.deep_linking]` in the Flet app's
 * pyproject.toml.
 */
export function buildAppRedirectUrl(params: Record<string, string>): string {
  const scheme = requireEnv("APP_REDIRECT_SCHEME");
  const host = process.env.APP_REDIRECT_HOST || "oauth2redirect";
  const query = new URLSearchParams(params).toString();
  return `${scheme}://${host}/callback${query ? `?${query}` : ""}`;
}

/** Optional shared secret required on server-to-server calls (token refresh). */
export function isAppSecretValid(request: NextRequest): boolean {
  const expected = process.env.APP_SHARED_SECRET;
  if (!expected) return true; // not configured: not enforced
  return request.headers.get("x-app-secret") === expected;
}
