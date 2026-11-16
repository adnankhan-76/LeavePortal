import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminById, getUserById, getUserLeaveBalances } from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("sika_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ success: false, user: null }, { status: 401 });
    }

    let parsed;
    try {
      parsed = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json({ success: false, user: null }, { status: 401 });
    }

    if (parsed.role === "admin") {
      const admin = getAdminById(parsed.id);
      if (!admin) {
        return NextResponse.json({ success: false, user: null }, { status: 401 });
      }
      return NextResponse.json({
        success: true,
        user: { ...admin, role: "admin", department: "Administration" },
        balances: null,
      });
    }

    // Regular user
    const freshUser = getUserById(parsed.id);
    if (!freshUser) {
      return NextResponse.json({ success: false, user: null }, { status: 401 });
    }

    const balances = getUserLeaveBalances(freshUser.id);

    return NextResponse.json({
      success: true,
      user: { ...freshUser, role: "user" },
      balances,
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ success: false, user: null }, { status: 500 });
  }
}
