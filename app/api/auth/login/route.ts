import { NextResponse } from "next/server";
import { getAdminByEmail, getUserByEmail, ensureDefaultAdmin } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check 'admin' table
    let admin = await getAdminByEmail(normalizedEmail);

    // Fallback: if user typed admin@sikka.com or admin@sikka.com.pk
    if (!admin && (normalizedEmail === "admin@sikka.com.pk" || normalizedEmail === "admin@sikka.com")) {
      const alt = normalizedEmail === "admin@sikka.com.pk" ? "admin@sikka.com" : "admin@sikka.com.pk";
      admin = await getAdminByEmail(alt);
    }

    // Default admin fallback: auto-ensure credentials in database
    if (
      (!admin || admin.password !== password) &&
      (normalizedEmail === "admin@sikka.com.pk" || normalizedEmail === "admin@sikka.com") &&
      password === "123456"
    ) {
      await ensureDefaultAdmin();
      admin = await getAdminByEmail("admin@sikka.com.pk");
    }

    if (admin && admin.password === password) {
      const sessionUser = {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: "admin",
        department: "Administration",
        sickLeaves: 0,
        casualLeaves: 0,
        annualLeaves: 0,
      };

      const response = NextResponse.json({ success: true, user: sessionUser });
      response.cookies.set("sika_session", JSON.stringify(sessionUser), {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }

    // 2. Check 'users' table
    const user = await getUserByEmail(normalizedEmail);
    if (user && user.password === password) {
      const sessionUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role === "admin" ? "admin" : "user",
        department: user.department,
        sickLeaves: user.sickLeaves,
        casualLeaves: user.casualLeaves,
        annualLeaves: user.annualLeaves,
      };

      const response = NextResponse.json({ success: true, user: sessionUser });
      response.cookies.set("sika_session", JSON.stringify(sessionUser), {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }

    return NextResponse.json(
      { success: false, error: "Invalid email or password" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}
