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
export const GOOGLE_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/drive.file openid email";

// Cookies are scoped to /api/auth and short-lived: they only need to survive
// the round trip through Google's consent screen.
export const STATE_COOKIE = "gdrive_oauth_state";
export const VERIFIER_COOKIE = "gdrive_oauth_verifier";
export const APP_STATE_COOKIE = "gdrive_oauth_app_state";
export const WEB_RETURN_URL_COOKIE = "gdrive_oauth_web_return_url";

export function oauthCookieOptions() {
  return {
    httpOnly: true,
    // The browser returns from accounts.google.com to this backend, so the
    // OAuth state must survive a cross-site top-level redirect.
    secure: true,
    sameSite: "none" as const,
    maxAge: 300,
    path: "/api/auth",
  };
}

export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
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

export function validatedWebReturnUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isLoopback =
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      url.protocol === "http:";
    const configuredOrigins = (process.env.WEB_APP_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean);
    const isConfiguredOrigin = configuredOrigins.includes(url.origin);
    if ((!isLoopback && !isConfiguredOrigin) || url.username || url.password) {
      return null;
    }
    return `${url.origin}${url.pathname === "/callback" ? url.pathname : "/callback"}`;
  } catch {
    return null;
  }
}

export function buildWebRedirectUrl(
  baseUrl: string,
  params: Record<string, string>,
): string {
  const query = new URLSearchParams(params).toString();
  return `${baseUrl}${query ? `?${query}` : ""}`;
}

/** Optional shared secret required on server-to-server calls (token refresh). */
export function isAppSecretValid(request: NextRequest): boolean {
  const expected = process.env.APP_SHARED_SECRET;
  if (!expected) return true; // not configured: not enforced
  return request.headers.get("x-app-secret") === expected;
}
