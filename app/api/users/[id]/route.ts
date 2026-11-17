import { NextResponse } from "next/server";
import { updateUser, emailTakenByOther } from "@/lib/db";
import { isAdminRequest } from "@/lib/require-admin";

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
