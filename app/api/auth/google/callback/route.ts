
import { NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/link-safety";
import { getAdminByEmail, getUserByEmail, createGoogleUser, createNotification } from "@/lib/db";

const ALLOWED_DOMAIN = "sikka.com.pk";

export async function GET(request: NextRequest) {
  const appUrl = (
    process.env.APP_URL || "http://localhost:3000"
  ).replace(/\/$/, "");

  const redirectUri =
    `${appUrl}/api/auth/google/callback`;

  const fail = (message: string) => {
    const response = NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(message)}`,
        appUrl
      )
    );

    response.cookies.delete("google_oauth_state");
    response.cookies.delete("login_next");

    return response;
  };

  try {
    // 1. Read Google callback parameters
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const savedState =
      request.cookies.get("google_oauth_state")?.value;

    // 2. Check Google authorization errors
    if (searchParams.get("error")) {
      console.error(
        "Google OAuth error:",
        searchParams.get("error")
      );

      return fail("Google login was cancelled");
    }

    // 3. Validate OAuth state
    if (!code || !state || !savedState || state !== savedState) {
      return fail(
        "Invalid Google login request. Please try again"
      );
    }

    // 4. Check environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Google OAuth credentials are missing");

      return fail("Google OAuth configuration is missing");
    }

    // 5. Exchange authorization code for access token
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
        cache: "no-store",
      }
    );

    const tokens = await tokenResponse.json();

    console.log("GOOGLE TOKEN STATUS:", tokenResponse.status);
    console.log("GOOGLE TOKEN ERROR:", tokens.error || "none");
    console.log(
      "GOOGLE TOKEN DESCRIPTION:",
      tokens.error_description || "none"
    );

    // Stop if Google rejects the token request
    if (!tokenResponse.ok || !tokens.access_token) {
      return fail(
        `Google authentication failed: ${
          tokens.error || "Token exchange failed"
        }`
      );
    }

    // 6. Get Google user profile
    const infoRes = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
        cache: "no-store",
      }
    );

    if (!infoRes.ok) {
      console.error(
        "Google profile request failed:",
        infoRes.status
      );

      return fail("Could not read your Google profile");
    }

    const profile = await infoRes.json();

    // 7. Verify email
    const email = String(profile.email || "")
      .trim()
      .toLowerCase();

    if (!email || profile.email_verified !== true) {
      return fail("Your Google email is not verified");
    }

    // 8. Restrict login to company domain
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return fail(
        `Only @${ALLOWED_DOMAIN} accounts can use Google login`
      );
    }

    // 9. Find user in database
    let sessionUser = null;

    const admin = getAdminByEmail(email);

    if (admin) {
      sessionUser = {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: "admin",
        department: "Administration",
        sickLeaves: 0,
        casualLeaves: 0,
        annualLeaves: 0,
      };
    } else {
      const user = getUserByEmail(email);

      if (user) {
        sessionUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: "user",
          department: user.department,
          sickLeaves: user.sickLeaves,
          casualLeaves: user.casualLeaves,
          annualLeaves: user.annualLeaves,
        };
      }
    }

    // 10. First-time Google sign-in: save the @sikka.com.pk email, admin fills details later
    if (!sessionUser) {
      const created = createGoogleUser({
        name: String(profile.name || ""),
        email,
      });

      createNotification({
        recipient: "admin",
        type: "new_user",
        message: `${created.name} (${created.email}) signed in with Google. Please fill in their details and leaves.`,
      });

      sessionUser = {
        id: created.id,
        name: created.name,
        email: created.email,
        role: "user",
        department: created.department,
        sickLeaves: created.sickLeaves,
        casualLeaves: created.casualLeaves,
        annualLeaves: created.annualLeaves,
      };
    }

    // 11. Create login session
    // Go to the page the person came for (e.g. the leave link), re-validated here, else home.
    const nextPath = safeNextPath(request.cookies.get("login_next")?.value) ?? "/home";

    const response = NextResponse.redirect(
      new URL(nextPath, appUrl)
    );

    response.cookies.set(
      "sika_session",
      JSON.stringify(sessionUser),
      {
        httpOnly: true,
        secure: appUrl.startsWith("https://"),
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      }
    );

    // Remove OAuth state cookie
    response.cookies.delete("google_oauth_state");
    response.cookies.delete("login_next");

    console.log("Google login successful:", email);

    return response;

  } catch (error) {
    console.error("========== GOOGLE LOGIN ERROR ==========");
    console.error(error);
    console.error("=========================================");

    return NextResponse.redirect(
      new URL(
        "/login?error=Google%20login%20failed",
        appUrl
      )
    );
  }
}
