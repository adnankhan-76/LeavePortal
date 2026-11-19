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

    let parsed: { id: string; role: string };
    try {
      parsed = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json({ success: false, user: null }, { status: 401 });
    }

    // 1. Check if ID exists in admin table (admin-1 or any adm-*)
    const admin = await getAdminById(parsed.id);
    if (admin) {
      return NextResponse.json({
        success: true,
        user: { ...admin, role: "admin", department: "Administration" },
        balances: null,
      });
    }

    // 2. Otherwise check users table
    const freshUser = await getUserById(parsed.id);
    if (!freshUser) {
      return NextResponse.json({ success: false, user: null }, { status: 401 });
    }

    const effectiveRole = freshUser.role === "admin" ? "admin" : "user";
    const balances = effectiveRole === "admin" ? null : await getUserLeaveBalances(freshUser.id);

    return NextResponse.json({
      success: true,
      user: { ...freshUser, role: effectiveRole },
      balances,
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ success: false, user: null }, { status: 500 });
  }
}
