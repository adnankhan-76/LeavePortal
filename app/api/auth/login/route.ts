import { NextResponse } from "next/server";
import { getAdminByEmail, getUserByEmail } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // 1. Check 'admin' table
    const admin = await getAdminByEmail(email);
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
    const user = await getUserByEmail(email);
    if (user && user.password === password) {
      const sessionUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "user",
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
