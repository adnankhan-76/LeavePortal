import { NextResponse } from "next/server";
import crypto from "crypto";
import { safeNextPath } from "@/lib/link-safety";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (!clientId) {
    return NextResponse.redirect(
      new URL("/login?error=Google+login+is+not+configured", appUrl)
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    hd: "sikka.com.pk", // hint only: Google shows sikka.com.pk accounts. Real check is in the callback.
    prompt: "select_account",
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  // Remember where to send the person after Google login (validated; same-site allowlisted pages only).
  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  if (next) {
    response.cookies.set("login_next", next, {
      httpOnly: true,
      secure: appUrl.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
  }
  return response;
}
