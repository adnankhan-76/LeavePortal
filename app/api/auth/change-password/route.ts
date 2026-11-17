import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAdminByEmail,
  updateAdminPassword,
  getUserByEmail,
  updateUserPassword,
} from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { email, currentPassword, newPassword } = await request.json();

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 4 characters long" },
        { status: 400 }
      );
    }

    let targetEmail = email;
    if (!targetEmail) {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("sika_session");
      if (sessionCookie?.value) {
        try {
          const parsed = JSON.parse(sessionCookie.value);
          targetEmail = parsed.email;
        } catch {
          // ignore
        }
      }
    }

    if (!targetEmail) {
      return NextResponse.json(
        { success: false, error: "Target account email not specified" },
        { status: 400 }
      );
    }

    // 1. Check if it's admin in 'admin' table
    const admin = await getAdminByEmail(targetEmail);
    if (admin) {
      if (admin.password !== currentPassword) {
        return NextResponse.json(
          { success: false, error: "Current password is incorrect" },
          { status: 400 }
        );
      }
      const updated = await updateAdminPassword(admin.id, newPassword);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: "Failed to update admin password in SQLite" },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Admin password updated successfully in SQLite!",
      });
    }

    // 2. Check if it's user in 'users' table
    const user = await getUserByEmail(targetEmail);
    if (user) {
      if (user.password !== currentPassword) {
        return NextResponse.json(
          { success: false, error: "Current password is incorrect" },
          { status: 400 }
        );
      }
      const updated = await updateUserPassword(user.id, newPassword);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: "Failed to update user password in SQLite" },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "User password updated successfully in SQLite!",
      });
    }

    return NextResponse.json(
      { success: false, error: "Account not found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to change password" },
      { status: 500 }
    );
  }
}
