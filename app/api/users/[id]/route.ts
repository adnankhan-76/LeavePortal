import { NextResponse } from "next/server";
import { updateUser, emailTakenByOther, deleteUser } from "@/lib/db";
import { isAdminRequest, getSessionUser } from "@/lib/require-admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ success: false, error: "Admins only" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    if (body.email && (await emailTakenByOther(body.email, id))) {
      return NextResponse.json(
        { success: false, error: "Another account already uses this email" },
        { status: 409 }
      );
    }
    const user = await updateUser(id, {
      name: body.name,
      email: body.email,
      password: body.password || undefined,
      department: body.department,
      role: body.role || undefined,
      sickLeaves: body.sickLeaves === undefined ? undefined : Number(body.sickLeaves),
      casualLeaves: body.casualLeaves === undefined ? undefined : Number(body.casualLeaves),
      annualLeaves: body.annualLeaves === undefined ? undefined : Number(body.annualLeaves),
    });
    if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ success: false, error: "Failed to update user" }, { status: 500 });
  }
}


export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ success: false, error: "Admins only" }, { status: 403 });
    }
    const { id } = await params;
    const me = await getSessionUser();
    if (me?.id === id) {
      return NextResponse.json(
        { success: false, error: "You cannot delete your own account" },
        { status: 400 }
      );
    }
    const deleted = await deleteUser(id);
    if (!deleted) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete user" }, { status: 500 });
  }
}
