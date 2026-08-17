import { type NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_ABOUT_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_FILES_ENDPOINT,
  PICKER_APP_STATE_COOKIE,
  PICKER_ACCOUNT_COOKIE,
  PICKER_STATE_COOKIE,
  PICKER_VERIFIER_COOKIE,
  buildAppRedirectUrl,
  googleClientId,
  googleClientSecret,
  pickerCallbackRedirectUri,
} from "@/lib/google-oauth";

function clearPickerCookies(response: NextResponse): void {
  for (const name of [
    PICKER_STATE_COOKIE,
    PICKER_VERIFIER_COOKIE,
    PICKER_APP_STATE_COOKIE,
    PICKER_ACCOUNT_COOKIE,
  ]) {
    response.cookies.set(name, "", { path: "/api", maxAge: 0 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const appState = request.cookies.get(PICKER_APP_STATE_COOKIE)?.value ?? "";
  const accountId = request.cookies.get(PICKER_ACCOUNT_COOKIE)?.value ?? "";
  const pickedFileId = searchParams.get("picked_file_ids")?.split(",")[0] ?? "";
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(PICKER_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(PICKER_VERIFIER_COOKIE)?.value;

  if (searchParams.get("error") || !pickedFileId) {
    const response = NextResponse.redirect(
      buildAppRedirectUrl({ picker: "1", error: searchParams.get("error") ?? "cancelled", app_state: appState })
    );
    clearPickerCookies(response);
    return response;
  }

  if (!state || state !== expectedState || !verifier || !accountId) {
    const response = NextResponse.redirect(
      buildAppRedirectUrl({ picker: "1", error: "invalid_state", app_state: appState })
    );
    clearPickerCookies(response);
    return response;
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        code: searchParams.get("code") ?? "",
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: pickerCallbackRedirectUri(request),
      }),
    });
    if (!tokenResponse.ok) throw new Error("picker token exchange failed");
    const tokens = await tokenResponse.json();
    const aboutResponse = await fetch(
      `${GOOGLE_ABOUT_ENDPOINT}?fields=user(emailAddress)`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (!aboutResponse.ok) throw new Error("picker account lookup failed");
    const about = await aboutResponse.json();
    const fileResponse = await fetch(
      `${GOOGLE_FILES_ENDPOINT}/${encodeURIComponent(pickedFileId)}?fields=id,name,mimeType`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (!fileResponse.ok) throw new Error("picked folder lookup failed");
    const file = await fileResponse.json();
    if (file.mimeType !== "application/vnd.google-apps.folder") throw new Error("picked item is not a folder");

    const response = NextResponse.redirect(
      buildAppRedirectUrl({
        picker: "1",
        app_state: appState,
        account_id: accountId,
        folder_id: file.id,
        folder_name: file.name ?? "Carpeta de Google Drive",
        email: about.user?.emailAddress ?? "",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? "",
        expires_in: String(tokens.expires_in ?? 3600),
      })
    );
    clearPickerCookies(response);
    return response;
  } catch {
    const response = NextResponse.redirect(
      buildAppRedirectUrl({ picker: "1", error: "picker_server_error", app_state: appState })
    );
    clearPickerCookies(response);
    return response;
  }
}